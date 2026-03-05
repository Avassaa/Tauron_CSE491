// src/app/services/auth.service.ts
import { Injectable, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../environments/environment";

// Interfaces matching your backend DTOs (adjust properties as needed)
export interface AuthenticationRequest {
  email?: string; // Or userName depending on your backend setup
  password?: string;
}

export interface AuthenticationResponse {
  id?: string;
  userName?: string;
  email?: string;
  roles?: string[];
  isVerified?: boolean;
  jwToken?: string; // Matches backend JWTSettings name convention usually
  refreshToken?: string;
}

export interface RegisterRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  userName?: string;
  password?: string;
  confirmPassword?: string;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenKey = "authToken"; // Key for localStorage

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(
    credentials: AuthenticationRequest
  ): Observable<AuthenticationResponse> {
    return this.http
      .post<AuthenticationResponse>(
        `${this.apiUrl}/Account/authenticate`,
        credentials
      )
      .pipe(
        tap((response) => {
          this.storeToken(response);
          // Store login time
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem("lastLoginTime", new Date().toISOString());
          }
        })
      );
  }

  register(registerData: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/Account/register`, registerData, {
      responseType: "text", // Tell Angular to expect a text response
    });
  }
  logout(): void {
    // Only remove from localStorage if in the browser
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.tokenKey);
      // localStorage.removeItem('refreshToken'); // If storing refresh token here
    }
    // Optional: Add logic to clear any local state variables representing logged-in status
  }

  storeToken(response: AuthenticationResponse): void {
    // Only store in localStorage if in the browser
    if (isPlatformBrowser(this.platformId)) {
      if (response && response.jwToken) {
        localStorage.setItem(this.tokenKey, response.jwToken);
        // if (response.refreshToken) { localStorage.setItem('refreshToken', response.refreshToken); }
      }
    }
  }

  getToken(): string | null {
    // Only get from localStorage if in the browser
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.tokenKey); // <--- Original error location, now guarded
    }
    return null; // Return null if on the server
  }

  isLoggedIn(): boolean {
    // This will now correctly return false during SSR
    const token = this.getToken();
    // Add more robust checks if needed (e.g., token expiration check using a library like jwt-decode, also guarded by isPlatformBrowser)
    return !!token;
  }

  getDecodedToken(): any | null {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getToken();
      if (token) {
        try {
          // Simple base64 decoding of JWT payload
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          return JSON.parse(jsonPayload);
        } catch (error) {
          console.error("Error decoding token", error);
        }
      }
    }
    return null;
  }
  getUserFromToken(): any {
    const decodedToken = this.getDecodedToken();
    if (decodedToken) {
      return {
        email: decodedToken.email,
        id: decodedToken.uid, // Assuming your JWT has these properties
        username: decodedToken.sub,
        roles: decodedToken.roles,
      };
    }
    return null;
  }
}
