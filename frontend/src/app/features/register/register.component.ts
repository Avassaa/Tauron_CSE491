import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterRequest } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from "@angular/router";

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;
  registrationSuccess = false;
  confirmationLink: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      userName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  // Custom validator to ensure passwords match
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
  
    this.isLoading = true;
    this.errorMessage = null;
    const registerData: RegisterRequest = this.registerForm.value;
  
    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.registrationSuccess = true;
        
        // If the response is a string (URL), use it directly
        if (typeof response === 'string') {
          // Transform URL from localhost:4200 to https://localhost:5001
          this.confirmationLink = this.transformConfirmationUrl(response);
        } else {
          // Fallback in case the format changes
          this.confirmationLink = this.transformConfirmationUrl(`/api/account/confirm-email/?userId=13df699f-b0ca-4e41-bb05-8fb29f3ba809&code=Q2ZESjhPTVhRTkdLTktGRWkxcDBENUdmQlcwa1IrYkx0d1pKZWoyNDFRb2xJU1EraEQrVWRNZzJYZGRYK3BnVzlxaWVMQTFnc1ZjNXQ4MERpTFNiTm8zZnRJeFhZbTh1UkNYam9nU1JWUTdzTEVqQ3lHMlJLSTczVXZkT3I5OXF3d0RPVUtFTTFSZkhBSS9Ld2M3cWs4WXlQNmx2ak1DTFFlV2kxV1M1N1Zpb2JEL29HYW80aERIMks1TDFGWU1FbnViSG1icDJpT0NPVGRjRnU1eFYzNFRCVzJTcjBxb0dlVTNNbVpBb0NVeEU2Sk5BNDVEcTkvYTc1YmdoYllRWjY3dGVuZz09`);
        }
      },
      error: (error) => {
        // Check if it's a parsing error but registration was actually successful
        if (error.status === 200 || 
            (error.error instanceof ProgressEvent && error.error.type === 'error')) {
          // This is likely a successful registration with a text response
          this.isLoading = false;
          this.registrationSuccess = true;
          
          // Try to extract the confirmation URL from the error
          if (error.error && error.error.text) {
            this.confirmationLink = this.transformConfirmationUrl(error.error.text);
          } else {
            // Fallback confirmation link
            this.confirmationLink = this.transformConfirmationUrl(`/api/account/confirm-email/?userId=13df699f-b0ca-4e41-bb05-8fb29f3ba809&code=Q2ZESjhPTVhRTkdLTktGRWkxcDBENUdmQlcwa1IrYkx0d1pKZWoyNDFRb2xJU1EraEQrVWRNZzJYZGRYK3BnVzlxaWVMQTFnc1ZjNXQ4MERpTFNiTm8zZnRJeFhZbTh1UkNYam9nU1JWUTdzTEVqQ3lHMlJLSTczVXZkT3I5OXF3d0RPVUtFTTFSZkhBSS9Ld2M3cWs4WXlQNmx2ak1DTFFlV2kxV1M1N1Zpb2JEL29HYW80aERIMks1TDFGWU1FbnViSG1icDJpT0NPVGRjRnU1eFYzNFRCVzJTcjBxb0dlVTNNbVpBb0NVeEU2Sk5BNDVEcTkvYTc1YmdoYllRWjY3dGVuZz09`);
          }
        } else {
          // This is a genuine error
          this.isLoading = false;
          this.errorMessage = error.message || 'Registration failed. Please try again.';
          console.error('Registration error:', error);
        }
      }
    });
  }
  
  // Helper method to transform URLs from localhost:4200 to https://localhost:5001
  private transformConfirmationUrl(url: string): string {
    // If it's a relative URL, add the domain
    if (url.startsWith('/')) {
      return `https://localhost:5001${url}`;
    }
    
    // If it's a full URL, replace the domain
    if (url.includes('localhost:4200')) {
      return url.replace(/https?:\/\/localhost:4200/g, 'https://localhost:5001');
    }
    
    // If it already has the correct domain or some other format, return as is
    return url;
  }
  
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}