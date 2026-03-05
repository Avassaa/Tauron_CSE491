import { RouterModule } from "@angular/router";
import { Component, OnInit } from '@angular/core';
// Import Reactive Forms modules
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthenticationRequest } from '../../services/auth.service'; // Adjust path
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  // Make sure ReactiveFormsModule is here
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './login.component.html',
  // styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  // Declare the FormGroup
  loginForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder, // Inject FormBuilder
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize the form
    this.loginForm = this.fb.group({
      // Define controls matching your backend needs
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      // rememberMe: [false] // Optional: Add if you have a rememberMe control
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
  
    this.isLoading = true;
    this.errorMessage = null;
    const credentials: AuthenticationRequest = this.loginForm.value;
  
    this.authService.login(credentials).subscribe({
      next: (response) => {
        // Handle successful login
        this.isLoading = false;
        this.router.navigate(['/home']); // Or wherever to redirect after login
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage ='Login failed. Please try again.';
        console.error('Login error:', error);
      }
    });
  }
}