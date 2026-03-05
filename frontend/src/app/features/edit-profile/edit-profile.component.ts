import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { UserService } from "../../services/user.service";

interface UserDetails {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
}

@Component({
  selector: "app-edit-profile",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./edit-profile.component.html",
  styleUrl: "./edit-profile.component.scss",
})
export class EditProfileComponent implements OnInit {
  user: UserDetails = {
    firstName: "",
    lastName: "",
    userName: "",
    email: ""
  };

  // Password fields
  passwordData = {
    email: "",
    token: "", // We'll handle this differently in a real implementation
    password: "",
    confirmPassword: "",
  };

  // Error messages
  error: string | null = null;
  
  // Success messages
  profileUpdateSuccess = false;
  passwordUpdateSuccess = false;
  
  // Loading states
  isLoading = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.userService.getUserDetails().subscribe({
      next: (response) => {
        if (response.succeeded) {
          const userData = response.data;
          this.user = {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            userName: userData.userName || '',
            email: userData.email || ''
          };
          
          // Set email for password reset
          this.passwordData.email = userData.email;
        } else {
          this.error = "Could not load user profile";
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = "Error loading profile: " + (err.error?.message || "Unknown error");
        this.isLoading = false;
      }
    });
  }

  updateProfile(): void {
    this.isLoading = true;
    this.error = null;
    
    const updateData = {
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      userName: this.user.userName
    };

    this.userService.updateUserDetails(updateData).subscribe({
      next: (response) => {
        if (response.succeeded) {
          this.profileUpdateSuccess = true;
          setTimeout(() => (this.profileUpdateSuccess = false), 3000);
        } else {
          this.error = response.message || "Update failed";
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = "Error updating profile: " + (err.error?.message || "Unknown error");
        this.isLoading = false;
      }
    });
  }

  updatePassword(): void {
    this.isLoading = true;
    this.error = null;
  
    // Check if passwords match
    if (this.passwordData.password !== this.passwordData.confirmPassword) {
      this.error = "Passwords do not match";
      this.isLoading = false;
      return;
    }
  
    // Check password length
    if (this.passwordData.password.length < 6) {
      this.error = "Password must be at least 6 characters long";
      this.isLoading = false;
      return;
    }
  
    // Step 1: Request a token using the forgot-password endpoint
    this.userService.forgotPassword(this.passwordData.email).subscribe({
      next: (response) => {
        if (response.to && response.body) {
          // Extract the token from the response body
          this.passwordData.token = response.body;
  
          // Step 2: Use the token to reset the password
          this.userService.changePassword(this.passwordData).subscribe({
            next: (resetResponse) => {
              // Since the response is plain text, we check if it contains success message
              if (resetResponse === 'Password changed.') {
                // Reset fields and show success message
                this.passwordData = {
                  email: this.user.email,
                  token: "",
                  password: "",
                  confirmPassword: "",
                };
          
                this.passwordUpdateSuccess = true;
                setTimeout(() => (this.passwordUpdateSuccess = false), 3000);
              } else {
                try {
                  // Try to parse as JSON in case it's an error response
                  const errorResponse = JSON.parse(resetResponse);
                  if (errorResponse.errors) {
                    // Extract validation errors
                    let validationErrors: any[] = [];
                    for (const field in errorResponse.errors) {
                      validationErrors = validationErrors.concat(errorResponse.errors[field]);
                    }
                    this.error = validationErrors.join(', ');
                  } else {
                    this.error = errorResponse.title || "Unexpected server response";
                  }
                } catch (e) {
                  // If it's not JSON and not the success message, show the response
                  this.error = resetResponse || "Unexpected server response";
                }
              }
              this.isLoading = false;
            },
            error: (err) => {
              try {
                // Try to parse error response
                const errorObj = JSON.parse(err.error);
                if (errorObj.errors) {
                  // Extract validation errors
                  let validationErrors: any[] = [];
                  for (const field in errorObj.errors) {
                    validationErrors = validationErrors.concat(errorObj.errors[field]);
                  }
                  this.error = validationErrors.join(', ');
                } else {
                  this.error = errorObj.title || "Error resetting password";
                }
              } catch (e) {
                // If parsing fails, use the original error message
                this.error = "Error resetting password: " + (err.error || "Unknown error");
              }
              this.isLoading = false;
            },
          });
        } else {
          this.error = "Failed to retrieve reset token";
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.error = "Error requesting password reset token: " + (err.error?.message || "Unknown error");
        this.isLoading = false;
      },
    });
  }
}