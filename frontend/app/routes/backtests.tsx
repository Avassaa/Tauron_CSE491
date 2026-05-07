"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"
import { FlaskConical, Loader2, Play, RefreshCw } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { DashboardLayout } from "~/components/dashboard/dashboard-layout"
import { PageBlueBackdrop } from "~/components/dashboard/page-blue-backdrop"
import { Button } from "~/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  glassPanelSurface,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { Switch } from "~/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { EvaluationOverlapChart } from "~/components/backtests/evaluation-overlap-chart"
import { DatePickerWithRange } from "~/components/dashboard/date-picker-with-range"
import {
  apiGet,
  apiPatch,
  apiPostLong,
  type AssetResponse,
  type MlModelResponse,
  type ModelEvaluationSummaryResponse,
  type PaginatedResponse,
} from "~/lib/api-client"
import { cn } from "~/lib/utils"

const MODEL_ARCHITECTURE_SLUG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "__default__", label: "Use server default" },
  { value: "hgb_ocm", label: "HistGradientBoosting (hgb_ocm)" },
  { value: "ridge_ocm", label: "Ridge (ridge_ocm)" },
  { value: "rf_ocm", label: "Random forest (rf_ocm)" },
  { value: "et_ocm", label: "Extra trees (et_ocm)" },
  { value: "lgbm_ocm", label: "LightGBM (lgbm_ocm)" },
  { value: "lstm_ocm", label: "LSTM (lstm_ocm)" },
]

function startOfUtcDayFromLocalCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0))
}

function utcCalendarYmdFromLocalDate(d: Date): string {
  return startOfUtcDayFromLocalCalendarDate(d).toISOString().slice(0, 10)
}

const EVAL_POINTS_CHART_VISIBLE_CAP = 500

interface TrainerHyperparameterRuntimeFlags {
  lightgbm_import_available: boolean
  torch_import_available: boolean
}

interface TrainerHyperparameterFieldDescriptor {
  parameter_key: string
  label: string
  hint: string
  value_kind: "int" | "float"
  minimum: number | null
  maximum: number | null
  default_value: number | null
}

interface TrainerHyperparameterSchemaEnvelope {
  default_model_type_slug: string
  sklearn_model_type_slugs: string[]
  lstm_model_type_slug: string
  time_series_cv_folds_shared: TrainerHyperparameterFieldDescriptor
  sklearn_hyperparameter_fields_by_slug: Record<string, TrainerHyperparameterFieldDescriptor[]>
  lstm_ocm_hyperparameter_fields: TrainerHyperparameterFieldDescriptor[]
  runtime_capability_flags: TrainerHyperparameterRuntimeFlags
}

function defaultStringFromFieldDescriptor(descriptor: TrainerHyperparameterFieldDescriptor): string {
  if (descriptor.default_value === null || descriptor.default_value === undefined) {
    return ""
  }
  return String(descriptor.default_value)
}

function computeEffectiveTrainModelSlugExclusive(
  architectureChoiceExclusive: string,
  schemaExclusive: TrainerHyperparameterSchemaEnvelope | null,
): string {
  if (architectureChoiceExclusive !== "__default__") {
    return architectureChoiceExclusive
  }
  return schemaExclusive?.default_model_type_slug ?? "hgb_ocm"
}

function buildSeedHyperDraftMapExclusive(
  schemaExclusive: TrainerHyperparameterSchemaEnvelope,
  effectiveSlugExclusive: string,
): Record<string, string> {
  const draftSeedExclusive: Record<string, string> = {}
  if (effectiveSlugExclusive === schemaExclusive.lstm_model_type_slug) {
    for (const fieldDescriptor of schemaExclusive.lstm_ocm_hyperparameter_fields) {
      draftSeedExclusive[fieldDescriptor.parameter_key] = defaultStringFromFieldDescriptor(fieldDescriptor)
    }
    return draftSeedExclusive
  }
  draftSeedExclusive[schemaExclusive.time_series_cv_folds_shared.parameter_key] = defaultStringFromFieldDescriptor(
    schemaExclusive.time_series_cv_folds_shared,
  )
  const sklearnRowsExclusive =
    schemaExclusive.sklearn_hyperparameter_fields_by_slug[effectiveSlugExclusive] ?? []
  for (const fieldDescriptor of sklearnRowsExclusive) {
    draftSeedExclusive[fieldDescriptor.parameter_key] = defaultStringFromFieldDescriptor(fieldDescriptor)
  }
  return draftSeedExclusive
}

function collectActiveHyperparameterFieldListExclusive(
  schemaExclusive: TrainerHyperparameterSchemaEnvelope,
  effectiveSlugExclusive: string,
): TrainerHyperparameterFieldDescriptor[] {
  if (effectiveSlugExclusive === schemaExclusive.lstm_model_type_slug) {
    return schemaExclusive.lstm_ocm_hyperparameter_fields
  }
  return [
    schemaExclusive.time_series_cv_folds_shared,
    ...(schemaExclusive.sklearn_hyperparameter_fields_by_slug[effectiveSlugExclusive] ?? []),
  ]
}

function parseTrainerHyperparametersFromDraftsExclusive(
  schemaExclusive: TrainerHyperparameterSchemaEnvelope,
  effectiveSlugExclusive: string,
  draftMapExclusive: Record<string, string>,
): { ok: true; payload: Record<string, number> } | { ok: false; message: string } {
  const targetFieldsExclusive = collectActiveHyperparameterFieldListExclusive(
    schemaExclusive,
    effectiveSlugExclusive,
  )
  const payloadExclusive: Record<string, number> = {}
  for (const fieldDescriptor of targetFieldsExclusive) {
    const rawLiteralExclusive = draftMapExclusive[fieldDescriptor.parameter_key] ?? ""
    const trimmedExclusive = rawLiteralExclusive.trim()
    if (!trimmedExclusive) {
      return {
        ok: false,
        message: `Enter a value for “${fieldDescriptor.label}”.`,
      }
    }
    const parsedExclusive =
      fieldDescriptor.value_kind === "int"
        ? Number.parseInt(trimmedExclusive, 10)
        : Number.parseFloat(trimmedExclusive)
    if (!Number.isFinite(parsedExclusive)) {
      return {
        ok: false,
        message: `“${fieldDescriptor.label}” must be a number.`,
      }
    }
    let clampedExclusive = parsedExclusive
    if (fieldDescriptor.minimum != null) {
      clampedExclusive = Math.max(fieldDescriptor.minimum, clampedExclusive)
    }
    if (fieldDescriptor.maximum != null) {
      clampedExclusive = Math.min(fieldDescriptor.maximum, clampedExclusive)
    }
    payloadExclusive[fieldDescriptor.parameter_key] =
      fieldDescriptor.value_kind === "int" ? Math.round(clampedExclusive) : clampedExclusive
  }
  return { ok: true, payload: payloadExclusive }
}

interface TrainAssetNotificationResponse {
  ok: boolean
  status: string
  message: string
  model_id?: string | null
  forecast_horizon_days?: number | null
  prediction_rows_written?: number | null
  forward_prediction_rows_written?: number | null
  retrospective_prediction_rows_written?: number | null
  detail?: string | null
}

function formatHumanModelLabel(candidate: MlModelResponse): string {
  const trimmedDisplayNameExclusive = candidate.display_name?.trim()
  if (trimmedDisplayNameExclusive) {
    return `${trimmedDisplayNameExclusive}`
  }
  const typeSnippetExclusive = candidate.model_type?.trim() || "Model"
  return `${typeSnippetExclusive} (${candidate.version_tag})`
}

function formatOptionalStatistic(
  statistic: number | null | undefined,
  fractionDigitsExclusive: number,
): string {
  if (statistic === null || statistic === undefined || Number.isNaN(statistic)) return "—"
  return statistic.toFixed(fractionDigitsExclusive)
}

function formatOptionalPercentageRate(
  rate: number | null | undefined,
  fractionDigitsExclusive: number,
): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "—"
  return `${(rate * 100).toFixed(fractionDigitsExclusive)}%`
}

export default function BacktestsRoute() {
  const [assetRowsExclusive, setAssetRowsExclusive] = React.useState<AssetResponse[]>([])
  const [assetRowsLoadingExclusive, setAssetRowsLoadingExclusive] = React.useState(true)
  const [selectedAssetIdExclusive, setSelectedAssetIdExclusive] = React.useState("")

  const [modelRowsExclusive, setModelRowsExclusive] = React.useState<MlModelResponse[]>([])
  const [modelRowsLoadingExclusive, setModelRowsLoadingExclusive] = React.useState(false)

  const [selectedModelIdForAnalysisExclusive, setSelectedModelIdForAnalysisExclusive] = React.useState("")
  const [selectedModelIdForRenameExclusive, setSelectedModelIdForRenameExclusive] = React.useState("")

  const [trainArchitectureSlugExclusive, setTrainArchitectureSlugExclusive] = React.useState("__default__")
  const [trainDisplayNameDraftExclusive, setTrainDisplayNameDraftExclusive] = React.useState("")
  const [trainInclusiveDataCutoffUtcDayExclusive, setTrainInclusiveDataCutoffUtcDayExclusive] =
    React.useState("2024-01-01")
  const [trainForecastHorizonDraftExclusive, setTrainForecastHorizonDraftExclusive] = React.useState("30")
  const [trainVersionTagPrefixDraftExclusive, setTrainVersionTagPrefixDraftExclusive] = React.useState("")
  const [activateTrainedRegistryRowExclusive, setActivateTrainedRegistryRowExclusive] = React.useState(true)
  const [trainHyperTuneEnabledExclusive, setTrainHyperTuneEnabledExclusive] = React.useState(false)
  const [trainerHyperparameterSchemaExclusive, setTrainerHyperparameterSchemaExclusive] =
    React.useState<TrainerHyperparameterSchemaEnvelope | null>(null)
  const [trainerHyperparameterSchemaBusyExclusive, setTrainerHyperparameterSchemaBusyExclusive] =
    React.useState(false)
  const [trainerHyperparameterSchemaErrorExclusive, setTrainerHyperparameterSchemaErrorExclusive] =
    React.useState<string | null>(null)
  const [trainHyperDraftsExclusive, setTrainHyperDraftsExclusive] = React.useState<Record<string, string>>({})
  const [trainSubmissionBusyExclusive, setTrainSubmissionBusyExclusive] = React.useState(false)
  const [evaluationBusyExclusive, setEvaluationBusyExclusive] = React.useState(false)
  const [evaluationBundleExclusive, setEvaluationBundleExclusive] =
    React.useState<ModelEvaluationSummaryResponse | null>(null)
  const [evalDateRangeExclusive, setEvalDateRangeExclusive] = React.useState<DateRange | undefined>(() => ({
    from: new Date(2024, 0, 1),
    to: new Date(2027, 11, 31),
  }))

  const [renameDraftExclusive, setRenameDraftExclusive] = React.useState("")
  const [renameBusyExclusive, setRenameBusyExclusive] = React.useState(false)

  const effectiveTrainModelSlugExclusive = React.useMemo(
    () =>
      computeEffectiveTrainModelSlugExclusive(
        trainArchitectureSlugExclusive,
        trainerHyperparameterSchemaExclusive,
      ),
    [trainArchitectureSlugExclusive, trainerHyperparameterSchemaExclusive],
  )

  React.useEffect(() => {
    let cancelledExclusive = false
    void (async () => {
      setTrainerHyperparameterSchemaBusyExclusive(true)
      setTrainerHyperparameterSchemaErrorExclusive(null)
      try {
        const envelopeExclusive = await apiGet<TrainerHyperparameterSchemaEnvelope>(
          "/ml-training/trainer-hyperparameter-schema",
        )
        if (!cancelledExclusive) {
          setTrainerHyperparameterSchemaExclusive(envelopeExclusive)
        }
      } catch (fetchFailureExclusive) {
        if (!cancelledExclusive) {
          setTrainerHyperparameterSchemaExclusive(null)
          setTrainerHyperparameterSchemaErrorExclusive(
            fetchFailureExclusive instanceof Error ? fetchFailureExclusive.message : "Schema unavailable",
          )
        }
      } finally {
        if (!cancelledExclusive) setTrainerHyperparameterSchemaBusyExclusive(false)
      }
    })()
    return () => {
      cancelledExclusive = true
    }
  }, [])

  React.useEffect(() => {
    if (!trainHyperTuneEnabledExclusive || !trainerHyperparameterSchemaExclusive) {
      return
    }
    setTrainHyperDraftsExclusive(
      buildSeedHyperDraftMapExclusive(trainerHyperparameterSchemaExclusive, effectiveTrainModelSlugExclusive),
    )
  }, [
    trainHyperTuneEnabledExclusive,
    trainerHyperparameterSchemaExclusive,
    trainArchitectureSlugExclusive,
    effectiveTrainModelSlugExclusive,
  ])

  React.useEffect(() => {
    let cancelledExclusive = false
    void (async () => {
      setAssetRowsLoadingExclusive(true)
      try {
        const pageBundleExclusive = await apiGet<PaginatedResponse<AssetResponse>>("/assets", {
          page: 1,
          page_size: 500,
          is_active: true,
        })
        if (!cancelledExclusive) {
          setAssetRowsExclusive(pageBundleExclusive.items)
          if (
            pageBundleExclusive.items.length > 0 &&
            !selectedAssetIdExclusive.trim()
          ) {
            setSelectedAssetIdExclusive(pageBundleExclusive.items[0].id)
          }
        }
      } catch (errorExclusive) {
        if (!cancelledExclusive) toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Assets failed")
      } finally {
        if (!cancelledExclusive) setAssetRowsLoadingExclusive(false)
      }
    })()
    return () => {
      cancelledExclusive = true
    }
  }, [])

  React.useEffect(() => {
    if (!selectedAssetIdExclusive.trim()) {
      setModelRowsExclusive([])
      setSelectedModelIdForAnalysisExclusive("")
      setSelectedModelIdForRenameExclusive("")
      setRenameDraftExclusive("")
      return
    }

    let cancelledExclusive = false
    void (async () => {
      setModelRowsLoadingExclusive(true)
      try {
        const registryPageExclusive = await apiGet<PaginatedResponse<MlModelResponse>>("/predictions/models", {
          asset_id: selectedAssetIdExclusive.trim(),
          page: 1,
          page_size: 200,
        })
        if (cancelledExclusive) return
        const nextRowsExclusive = registryPageExclusive.items
        setModelRowsExclusive(nextRowsExclusive)
        if (nextRowsExclusive.length > 0) {
          const firstRowExclusive = nextRowsExclusive[0]
          setSelectedModelIdForAnalysisExclusive(firstRowExclusive.id)
          setSelectedModelIdForRenameExclusive(firstRowExclusive.id)
          setRenameDraftExclusive(firstRowExclusive.display_name?.trim() ?? "")
        } else {
          setSelectedModelIdForAnalysisExclusive("")
          setSelectedModelIdForRenameExclusive("")
          setRenameDraftExclusive("")
        }
      } catch (errorExclusive) {
        if (!cancelledExclusive) toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Models failed")
      } finally {
        if (!cancelledExclusive) setModelRowsLoadingExclusive(false)
      }
    })()

    return () => {
      cancelledExclusive = true
    }
  }, [selectedAssetIdExclusive])

  const reloadModelsExclusive = React.useCallback(async () => {
    if (!selectedAssetIdExclusive.trim()) return
    setModelRowsLoadingExclusive(true)
    try {
      const registryPageExclusive = await apiGet<PaginatedResponse<MlModelResponse>>("/predictions/models", {
        asset_id: selectedAssetIdExclusive.trim(),
        page: 1,
        page_size: 200,
      })
      setModelRowsExclusive(registryPageExclusive.items)
    } catch (errorExclusive) {
      toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Models failed")
    } finally {
      setModelRowsLoadingExclusive(false)
    }
  }, [selectedAssetIdExclusive])

  async function enqueueTrainingJobExclusive() {
    if (!selectedAssetIdExclusive.trim()) {
      toast.error("Choose an asset first.")
      return
    }
    setTrainSubmissionBusyExclusive(true)
    try {
      let trainerHyperExclusive: Record<string, number> | null = null
      if (trainHyperTuneEnabledExclusive) {
        if (!trainerHyperparameterSchemaExclusive) {
          toast.error("Trainer field catalog is still loading. Try again in a moment.")
          return
        }
        const hyperBundleExclusive = parseTrainerHyperparametersFromDraftsExclusive(
          trainerHyperparameterSchemaExclusive,
          effectiveTrainModelSlugExclusive,
          trainHyperDraftsExclusive,
        )
        if (!hyperBundleExclusive.ok) {
          toast.error(hyperBundleExclusive.message)
          return
        }
        trainerHyperExclusive = hyperBundleExclusive.payload
      }

      if (!trainInclusiveDataCutoffUtcDayExclusive.trim()) {
        toast.error("Pick the last UTC calendar day you allow into training (data cutoff).")
        return
      }

      const horizonParsedExclusive = Number.parseInt(trainForecastHorizonDraftExclusive.trim(), 10)

      const bodyPayloadExclusive: Record<string, unknown> = {
        asset_id: selectedAssetIdExclusive.trim(),
        activate_model: activateTrainedRegistryRowExclusive,
      }

      if (trainArchitectureSlugExclusive !== "__default__") {
        bodyPayloadExclusive.model_type = trainArchitectureSlugExclusive
      }
      if (trainDisplayNameDraftExclusive.trim()) {
        bodyPayloadExclusive.display_name = trainDisplayNameDraftExclusive.trim().slice(0, 120)
      }
      bodyPayloadExclusive.maximum_training_feature_calendar_day_utc =
        trainInclusiveDataCutoffUtcDayExclusive.trim()

      if (Number.isFinite(horizonParsedExclusive) && horizonParsedExclusive > 0) {
        bodyPayloadExclusive.forecast_horizon_days = horizonParsedExclusive
      }
      if (trainVersionTagPrefixDraftExclusive.trim()) {
        bodyPayloadExclusive.version_tag_prefix = trainVersionTagPrefixDraftExclusive.trim().slice(0, 40)
      }
      if (trainerHyperExclusive) {
        bodyPayloadExclusive.trainer_hyperparameters = trainerHyperExclusive
      }

      const notificationExclusive = await apiPostLong<TrainAssetNotificationResponse>(
        "/ml-training/train-asset",
        bodyPayloadExclusive,
        600_000,
      )

      if (notificationExclusive.ok && notificationExclusive.status === "trained") {
        toast.success(notificationExclusive.message)
        if (notificationExclusive.model_id) {
          const modelIdLiteral = String(notificationExclusive.model_id)
          setSelectedModelIdForAnalysisExclusive(modelIdLiteral)
          setSelectedModelIdForRenameExclusive(modelIdLiteral)
        }
        await reloadModelsExclusive()
      } else if (notificationExclusive.ok && notificationExclusive.status === "skipped") {
        toast.message(notificationExclusive.message)
      } else if (!notificationExclusive.ok) {
        toast.error(notificationExclusive.message)
      } else {
        toast.message(notificationExclusive.message)
        await reloadModelsExclusive()
      }
    } catch (errorExclusive) {
      toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Training failed")
    } finally {
      setTrainSubmissionBusyExclusive(false)
    }
  }

  async function runOverlapEvaluationExclusive() {
    if (!selectedAssetIdExclusive.trim() || !selectedModelIdForAnalysisExclusive.trim()) {
      toast.error("Pick an asset and a model.")
      return
    }
    setEvaluationBusyExclusive(true)
    try {
      if (!evalDateRangeExclusive?.from || !evalDateRangeExclusive.to) {
        toast.error("Pick an evaluation date range.")
        return
      }
      const bundleExclusive = await apiGet<ModelEvaluationSummaryResponse>("/predictions/model-evaluation", {
        asset_id: selectedAssetIdExclusive.trim(),
        model_id: selectedModelIdForAnalysisExclusive.trim(),
        eval_start_day: utcCalendarYmdFromLocalDate(evalDateRangeExclusive.from),
        eval_end_day: utcCalendarYmdFromLocalDate(evalDateRangeExclusive.to),
        daily_resolution_exclusive: "1d",
      })
      setEvaluationBundleExclusive(bundleExclusive)
      if (bundleExclusive.overlap_count === 0) {
        toast.message("No overlapping prediction buckets with daily closes in that window.")
      } else {
        toast.success(`Compared ${bundleExclusive.overlap_count} overlapping days.`)
      }
    } catch (errorExclusive) {
      toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Evaluation failed")
    } finally {
      setEvaluationBusyExclusive(false)
    }
  }

  async function persistDisplayNameExclusive() {
    if (!selectedModelIdForRenameExclusive.trim()) {
      toast.error("Pick a model to rename.")
      return
    }
    setRenameBusyExclusive(true)
    try {
      const refreshedRowExclusive = await apiPatch<MlModelResponse>(
        `/ml-models/${selectedModelIdForRenameExclusive.trim()}/display-name`,
        { display_name: renameDraftExclusive.trim() ? renameDraftExclusive.trim().slice(0, 120) : null },
      )
      toast.success("Model label saved.")
      setRenameDraftExclusive(refreshedRowExclusive.display_name?.trim() ?? "")
      await reloadModelsExclusive()
    } catch (errorExclusive) {
      toast.error(errorExclusive instanceof Error ? errorExclusive.message : "Rename failed")
    } finally {
      setRenameBusyExclusive(false)
    }
  }

  const selectedAssetRecordExclusive =
    assetRowsExclusive.find((a) => a.id === selectedAssetIdExclusive) ?? null

  const visibleEvaluationPointsExclusive = evaluationBundleExclusive
    ? evaluationBundleExclusive.points.slice(0, EVAL_POINTS_CHART_VISIBLE_CAP)
    : []

  return (
    <DashboardLayout
      title={
        <span className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-4 text-blue-500" />
          Backtests
        </span>
      }
      actions={
        <Button variant="outline" size="sm" className="h-9 rounded-xl" asChild>
          <Link to="/predictions">Open Predictions</Link>
        </Button>
      }
    >
      <div className="relative w-full min-h-full pt-4 md:pt-6">
        <PageBlueBackdrop />
        <div className="relative z-10 flex w-full flex-col gap-6 px-4 pb-12 md:px-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard" className="font-bold">
                    Dashboard
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Backtests</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black tracking-tight">Walk-forward lab</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Choose the last UTC calendar day you want in the training frame, how many forward daily predictions to
              persist, then compare mids to realised PriceUSD in any window that includes those post-cutoff dates.
            </p>
          </div>

          <Card className={cn(glassPanelSurface, "gap-0 py-0")}>
            <CardHeader className="border-b border-border/40 py-4">
              <CardTitle className="text-base">Scope</CardTitle>
              <CardDescription>Asset context shared by training, evaluation, and renaming.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Asset</Label>
                {assetRowsLoadingExclusive ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedAssetIdExclusive} onValueChange={setSelectedAssetIdExclusive}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetRowsExclusive.map((assetRow) => (
                        <SelectItem key={assetRow.id} value={assetRow.id}>
                          {assetRow.name} ({assetRow.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void reloadModelsExclusive()}
                  disabled={!selectedAssetIdExclusive.trim() || modelRowsLoadingExclusive}
                >
                  <RefreshCw className={cn("mr-2 size-4", modelRowsLoadingExclusive && "animate-spin")} />
                  Refresh models
                </Button>
              </div>
              <Separator className="sm:col-span-2 max-w-full" />
              <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-border/30 bg-muted/15 p-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[160px] flex-1 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Rename model
                  </p>
                  {modelRowsLoadingExclusive ? (
                    <Skeleton className="h-9 w-full rounded-lg" />
                  ) : (
                    <Select
                      value={selectedModelIdForRenameExclusive || undefined}
                      onValueChange={(value) => {
                        setSelectedModelIdForRenameExclusive(value)
                        const matchRowExclusive = modelRowsExclusive.find((m) => m.id === value)
                        setRenameDraftExclusive(matchRowExclusive?.display_name?.trim() ?? "")
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-lg" disabled={modelRowsExclusive.length === 0}>
                        <SelectValue placeholder={modelRowsExclusive.length === 0 ? "No models yet" : "Model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelRowsExclusive.map((modelRow) => (
                          <SelectItem key={`rn-${modelRow.id}`} value={modelRow.id}>
                            {formatHumanModelLabel(modelRow)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="min-w-[200px] flex-[2] space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display name</p>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Optional label…"
                    value={renameDraftExclusive}
                    onChange={(event) => setRenameDraftExclusive(event.target.value)}
                    maxLength={120}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 rounded-lg px-4"
                  onClick={() => void persistDisplayNameExclusive()}
                  disabled={renameBusyExclusive || !selectedModelIdForRenameExclusive.trim()}
                >
                  {renameBusyExclusive ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                  Save label
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className={cn(glassPanelSurface, "gap-0 py-0")}>
              <CardHeader className="border-b border-border/40 py-4">
                <CardTitle className="text-base">Generate / train</CardTitle>
                <CardDescription>
                  Fits only on rows through your data cutoff (inclusive). The compounded horizon is written for the
                  next N calendar days after that last bar. Holdout replay rows stay out unless enabled via API.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Architecture
                    </Label>
                    <Select
                      value={trainArchitectureSlugExclusive}
                      onValueChange={setTrainArchitectureSlugExclusive}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_ARCHITECTURE_SLUG_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Model display name
                    </Label>
                    <Input
                      className="h-10 rounded-xl"
                      placeholder="e.g. BTC ridge walk-forward 2024"
                      value={trainDisplayNameDraftExclusive}
                      onChange={(event) => setTrainDisplayNameDraftExclusive(event.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Data cutoff (UTC day, inclusive)
                    </Label>
                    <Input
                      type="date"
                      className="h-10 rounded-xl"
                      value={trainInclusiveDataCutoffUtcDayExclusive}
                      onChange={(event) => setTrainInclusiveDataCutoffUtcDayExclusive(event.target.value)}
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Training and the forecast anchor use only rows through this day. Later ingested history is
                      ignored for this run so you can overlap with future realised prices cleanly.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Forward horizon (days)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={366}
                      className="h-10 rounded-xl"
                      value={trainForecastHorizonDraftExclusive}
                      onChange={(event) => setTrainForecastHorizonDraftExclusive(event.target.value)}
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Compounded daily mids start the day after your cutoff’s last feature bar; only these forward rows
                      hit the prediction store from this screen.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Version tag prefix (optional)
                    </Label>
                    <Input
                      className="h-10 rounded-xl"
                      placeholder="backtest"
                      value={trainVersionTagPrefixDraftExclusive}
                      onChange={(event) => setTrainVersionTagPrefixDraftExclusive(event.target.value)}
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Customize training hyperparameters</p>
                        <p className="text-xs text-muted-foreground">
                          Labelled fields are generated from the AI engine for{" "}
                          {trainArchitectureSlugExclusive === "__default__" ? (
                            <span>
                              the server default architecture (
                              <span className="font-mono text-[11px]">{effectiveTrainModelSlugExclusive}</span>)
                            </span>
                          ) : (
                            <span className="font-mono text-[11px]">{trainArchitectureSlugExclusive}</span>
                          )}
                          . Leave this off to use built-in defaults without sending overrides.
                        </p>
                      </div>
                      <Switch
                        checked={trainHyperTuneEnabledExclusive}
                        onCheckedChange={setTrainHyperTuneEnabledExclusive}
                        disabled={
                          trainerHyperparameterSchemaBusyExclusive && !trainerHyperparameterSchemaExclusive
                        }
                      />
                    </div>
                    {trainerHyperparameterSchemaErrorExclusive && !trainerHyperparameterSchemaExclusive && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Could not load the hyperparameter catalog ({trainerHyperparameterSchemaErrorExclusive}).
                      </p>
                    )}
                    {trainerHyperparameterSchemaBusyExclusive && !trainerHyperparameterSchemaExclusive && (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    )}
                    {trainHyperTuneEnabledExclusive && trainerHyperparameterSchemaExclusive && (
                      <div className="space-y-4">
                        {effectiveTrainModelSlugExclusive === "lgbm_ocm" &&
                          !trainerHyperparameterSchemaExclusive.runtime_capability_flags.lightgbm_import_available && (
                            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-50">
                              The AI engine reported that LightGBM is not installed. Pick another architecture or add
                              LightGBM to the worker container.
                            </p>
                          )}
                        {effectiveTrainModelSlugExclusive ===
                          trainerHyperparameterSchemaExclusive.lstm_model_type_slug &&
                          !trainerHyperparameterSchemaExclusive.runtime_capability_flags.torch_import_available && (
                            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-50">
                              The AI engine reported that PyTorch is not installed. Choose a sklearn architecture or add
                              Torch to the worker container.
                            </p>
                          )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {collectActiveHyperparameterFieldListExclusive(
                            trainerHyperparameterSchemaExclusive,
                            effectiveTrainModelSlugExclusive,
                          ).map((fieldDescriptorExclusive) => (
                            <div key={fieldDescriptorExclusive.parameter_key} className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                {fieldDescriptorExclusive.label}
                              </Label>
                              <Input
                                type="number"
                                className="h-10 rounded-xl font-mono text-sm"
                                step={fieldDescriptorExclusive.value_kind === "int" ? 1 : "any"}
                                min={fieldDescriptorExclusive.minimum ?? undefined}
                                max={fieldDescriptorExclusive.maximum ?? undefined}
                                value={trainHyperDraftsExclusive[fieldDescriptorExclusive.parameter_key] ?? ""}
                                onChange={(event) =>
                                  setTrainHyperDraftsExclusive((previousExclusive) => ({
                                    ...previousExclusive,
                                    [fieldDescriptorExclusive.parameter_key]: event.target.value,
                                  }))
                                }
                              />
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {fieldDescriptorExclusive.hint}
                              </p>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => {
                            if (!trainerHyperparameterSchemaExclusive) return
                            setTrainHyperDraftsExclusive(
                              buildSeedHyperDraftMapExclusive(
                                trainerHyperparameterSchemaExclusive,
                                effectiveTrainModelSlugExclusive,
                              ),
                            )
                          }}
                        >
                          Reset to suggested defaults
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">Activate after training</p>
                    <p className="text-xs text-muted-foreground">Sets the new row as the active model for the asset.</p>
                  </div>
                  <Switch
                    checked={activateTrainedRegistryRowExclusive}
                    onCheckedChange={setActivateTrainedRegistryRowExclusive}
                  />
                </div>
                <Button
                  type="button"
                  className="h-11 rounded-xl font-bold"
                  onClick={() => void enqueueTrainingJobExclusive()}
                  disabled={trainSubmissionBusyExclusive || !selectedAssetIdExclusive.trim()}
                >
                  {trainSubmissionBusyExclusive ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  Run training job
                </Button>
                <p className="text-xs text-muted-foreground">
                  First run can take several minutes; the request waits until the batch returns. Ensure{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">AI_ENGINE_BASE_URL</code> and matching
                  service keys are set on the API.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className={cn(glassPanelSurface, "gap-0 py-0")}>
            <CardHeader className="border-b border-border/40 py-4">
              <CardTitle className="text-base">Prediction vs on-chain PriceUSD</CardTitle>
              <CardDescription>
                Overlap window is inclusive on UTC calendar days. Mid prices are compared to same-day{" "}
                {selectedAssetRecordExclusive?.symbol ?? "asset"} PriceUSD from on_chain_metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 py-5">
              <div className="grid gap-4 lg:grid-cols-6">
                <div className="space-y-2 lg:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Evaluation model
                  </Label>
                  {modelRowsLoadingExclusive ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={selectedModelIdForAnalysisExclusive || undefined}
                      onValueChange={setSelectedModelIdForAnalysisExclusive}
                    >
                      <SelectTrigger className="h-10 rounded-xl" disabled={modelRowsExclusive.length === 0}>
                        <SelectValue
                          placeholder={modelRowsExclusive.length === 0 ? "Train or import predictions first" : undefined}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {modelRowsExclusive.map((modelRow) => (
                          <SelectItem key={`eval-${modelRow.id}`} value={modelRow.id}>
                            {formatHumanModelLabel(modelRow)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Evaluation window (UTC dates)
                  </Label>
                  <DatePickerWithRange
                    hideLabel
                    date={evalDateRangeExclusive}
                    onSelect={setEvalDateRangeExclusive}
                    disabled={evaluationBusyExclusive}
                    className="max-w-none"
                  />
                  {evalDateRangeExclusive?.from && evalDateRangeExclusive.to ? (
                    <p className="text-[11px] text-muted-foreground">
                      Inclusive UTC range:{" "}
                      <span className="font-mono">
                        {utcCalendarYmdFromLocalDate(evalDateRangeExclusive.from)} →{" "}
                        {utcCalendarYmdFromLocalDate(evalDateRangeExclusive.to)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-end lg:col-span-1">
                  <Button
                    type="button"
                    className="h-10 w-full rounded-xl font-bold"
                    onClick={() => void runOverlapEvaluationExclusive()}
                    disabled={
                      evaluationBusyExclusive ||
                      !selectedAssetIdExclusive.trim() ||
                      !selectedModelIdForAnalysisExclusive.trim()
                    }
                  >
                    {evaluationBusyExclusive ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                    Run overlap evaluation
                  </Button>
                </div>
              </div>

              {evaluationBundleExclusive && (
                <>
                  <Separator />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <StatisticTileExclusive
                      label="Overlap rows"
                      value={String(evaluationBundleExclusive.overlap_count)}
                      hint="prediction timestamps with a realised close"
                    />
                    <StatisticTileExclusive
                      label="MAE"
                      value={formatOptionalStatistic(evaluationBundleExclusive.mean_absolute_error, 6)}
                      hint="absolute mid error"
                    />
                    <StatisticTileExclusive
                      label="RMSE"
                      value={formatOptionalStatistic(evaluationBundleExclusive.root_mean_square_error, 6)}
                      hint="root mean square error"
                    />
                    <StatisticTileExclusive
                      label="MAPE"
                      value={
                        evaluationBundleExclusive.mean_absolute_percentage_error != null
                          ? `${evaluationBundleExclusive.mean_absolute_percentage_error.toFixed(2)}%`
                          : "—"
                      }
                      hint="percentage gap vs close"
                    />
                    <StatisticTileExclusive
                      label="Directional hit rate"
                      value={formatOptionalPercentageRate(evaluationBundleExclusive.directional_accuracy, 2)}
                      hint="predicted vs prior close sign agreement"
                    />
                  </div>

                  <div className={cn(glassPanelSurface, "rounded-xl border p-0")}>
                    <EvaluationOverlapChart
                      points={visibleEvaluationPointsExclusive}
                      totalPointCountExclusive={evaluationBundleExclusive.points.length}
                      visibleCapExclusive={EVAL_POINTS_CHART_VISIBLE_CAP}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

function StatisticTileExclusive(props: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{props.label}</p>
      <p className="text-lg font-black tabular-nums tracking-tight">{props.value}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{props.hint}</p>
    </div>
  )
}
