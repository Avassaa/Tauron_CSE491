import * as React from "react"
import { Button } from "~/components/ui/button"
import { Shield } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const [displayName, setDisplayName] = React.useState("Test Testoglu")
  const [bio, setBio] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = () => {
    setIsSaving(true)
    const toastId = toast.loading("Saving changes...")

    // Mock API call
    setTimeout(() => {
      setIsSaving(false)
      toast.success("Profile updated successfully!", {
        id: toastId,
      })
    }, 1200)
  }

  const handleCancel = () => {
    setDisplayName("Test Testoglu")
    setBio("")
    toast.info("Changes discarded.")
  }

  const handlePreview = () => {
    toast.message("Coming soon", {
      description: "Profile preview feature is currently under development.",
    })
  }

  const handlePhotoAction = (action: "update" | "remove") => {
    if (action === "update") {
      toast.info("Upload photo (demo)")
    } else {
      toast.error("Photo removed (demo)")
    }
  }

  const handleSecurityAction = (feature: string) => {
    toast.message(`${feature} Settings`, {
      description: `The ${feature} feature will be available on security section.`,
    })
  }

  return (
    <div className="space-y-10">
      <section className="space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">Profile Information</h3>
          <Button variant="outline" size="sm" onClick={handlePreview}>Preview Profile</Button>
        </div>

        <div className="grid gap-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-lg bg-muted/30 border border-dashed">
            <div className="relative group">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold border-2 border-primary/20 group-hover:border-primary transition-colors">
                {displayName.charAt(0)}
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => handlePhotoAction("update")}
              >
                <span className="text-white text-xs font-medium">Edit</span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-2xl tracking-tight">{displayName}</h4>
              <p className="text-muted-foreground">Personal Account · testoglu@tauron.dev</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => handlePhotoAction("update")}>Update Photo</Button>
                <Button variant="ghost" size="sm" onClick={() => handlePhotoAction("remove")}>Remove</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-semibold ml-1">Display Name</label>
              <input
                type="text"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold ml-1">Email Address</label>
              <input
                type="email"
                disabled
                className="flex h-11 w-full rounded-lg border border-input bg-muted/50 px-4 py-2 text-sm text-muted-foreground italic"
                defaultValue="testoglu@tauron.dev"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold ml-1">Bio</label>
            <textarea
              className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Share a few words about your investment strategy or professional background..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end gap-3">
          <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
          <Button className="px-8 shadow-md" onClick={handleSave} disabled={isSaving}>
            Save Changes
          </Button>
        </div>
      </section>

      {/* TODO: Add these to security tab later on */}
      <section className="space-y-6 rounded-xl border bg-card/50 p-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Account Security</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Ensure your account remains secure by updating your password regularly and enabling two-factor authentication.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleSecurityAction("Password")}>Update Password</Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleSecurityAction("2FA")}>Enable 2FA</Button>
        </div>
      </section>
    </div>
  )
}