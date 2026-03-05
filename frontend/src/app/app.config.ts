import { ApplicationConfig, provideZoneChangeDetection } from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withFetch,
} from "@angular/common/http";
import { HTTP_INTERCEPTORS } from "@angular/common/http";

import { routes } from "./app.routes";
import { AuthInterceptor } from "./interceptors/auth.interceptor";
import {
  provideClientHydration,
  withEventReplay,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ]
};
