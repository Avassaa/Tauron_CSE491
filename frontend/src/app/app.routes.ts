import { Routes } from "@angular/router";

// Import your components
import { HomeComponent } from "./features/home/home.component";
import { AboutComponent } from "./features/about/about.component";
import { ServicesComponent } from "./features/services/services.component";
import { NewsComponent } from "./features/news/news.component";
import { NewsDetailComponent } from './features/news-detail/news-detail.component';
import { SubscriptionComponent } from "./features/subscription/subscription.component";
import { LoginComponent } from "./features/login/login.component";
import { RegisterComponent } from "./features/register/register.component";
import { UserInfoComponent } from "./features/user-info/user-info.component";
import { EditProfileComponent } from "./features/edit-profile/edit-profile.component";
import { WalletComponent } from "./features/wallet/wallet.component";
import { WriteComponent } from './features/write/write.component';

// --- Import the Auth Guard ---
import { authGuard } from "./guards/auth.guard"; // Adjust the path if necessary

export const routes: Routes = [
  // --- Public Routes ---
  { path: "register", component: RegisterComponent },
  { path: "login", component: LoginComponent },
  { path: "home", component: HomeComponent },
  { path: "about", component: AboutComponent },
  { path: "services", component: ServicesComponent },
  { path: "news", component: NewsComponent },
  { path: 'news/:id', component: NewsDetailComponent },

  // --- Protected Routes (Require Login) ---
  {
    path: "user", // Renamed from "user-info" for clarity, but use your component name
    component: UserInfoComponent,
    canActivate: [authGuard], // Add the guard here
  },
  {
    path: "edit-profile",
    component: EditProfileComponent,
    canActivate: [authGuard], // Add the guard here
  },
  {
    path: "wallet",
    component: WalletComponent,
    canActivate: [authGuard], // Add the guard here
  },
  {
    path: "subscription",
    component: SubscriptionComponent,
    canActivate: [authGuard], // Add the guard here
  },
  {
    path: "write",
    component: WriteComponent,
    canActivate: [authGuard], // Add the guard here
  },

  // --- Redirects ---
  // Redirect empty path to home (more user-friendly than login if already logged in, but login works too)
  // If you prefer login as default: { path: "", redirectTo: "/login", pathMatch: "full" },
  { path: "", redirectTo: "/home", pathMatch: "full" },

  // Wildcard route - redirects any unmatched URL to home
  { path: "**", redirectTo: "/home" },
  // Or redirect to a dedicated "Not Found" component if you have one:
  // { path: '**', component: PageNotFoundComponent }
];