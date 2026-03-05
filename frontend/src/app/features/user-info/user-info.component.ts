import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { UserService } from "../../services/user.service";
import { AuthService } from "../../services/auth.service";

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  isVerified: boolean;
  roles: string[];
  memberSince?: string;
  lastLogin?: string;
  subscriptionType?: string;
}

@Component({
  selector: "app-user-info",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./user-info.component.html",
  styleUrl: "./user-info.component.scss",
  styles: [`
    .modal-backdrop {
      z-index: 1040;
    }
    .modal {
      z-index: 1050;
    }
  `]
})
export class UserInfoComponent implements OnInit {
  user: UserInfo = {
    id: '',
    firstName: '',
    lastName: '',
    userName: '',
    email: '',
    isVerified: false,
    roles: [],
    subscriptionType: 'Basic',
    memberSince: 'Loading...',
    lastLogin: 'Loading...'
  };

  isLoading = false;
  error: string | null = null;
  confirmCheckboxChecked = false;
  showDeleteConfirmation = false;
  deleteInProgress = false;
  deleteError: string | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  openDeleteConfirmation(): void {
    this.showDeleteConfirmation = true;
    this.deleteError = null;
    this.confirmCheckboxChecked = false;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDeleteAccount(): void {
    this.deleteInProgress = true;
    this.deleteError = null;
    
    this.userService.deleteAccount().subscribe({
      next: () => {
        this.authService.logout();
        
        window.location.href = '/'; 
      },
      error: (err) => {
        this.deleteError = "Failed to delete account: " + (err.error?.message || err.message || "Unknown error");
        this.deleteInProgress = false;
      }
    });
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.error = null;

    this.userService.getUserDetails().subscribe({
      next: (response) => {
        if (response.succeeded) {
          const userData = response.data;
          
          this.user = {
            id: userData.id,
            firstName: userData.firstName || 'Not set',
            lastName: userData.lastName || 'Not set',
            userName: userData.userName,
            email: userData.email,
            isVerified: userData.isVerified,
            roles: userData.roles || [],
            
            // Set the subscription type based on role
            subscriptionType: this.determineSubscriptionType(userData.roles),
            
            // Extract member since info from token
            memberSince: this.getMemberSince(),
            lastLogin: this.getLastLoginTime()
          };
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

  determineSubscriptionType(roles: string[]): string {
    if (!roles || roles.length === 0) return 'Basic';
    
    // Logic to determine subscription type based on roles
    if (roles.includes('Premium')) return 'Premium';
    if (roles.includes('Pro')) return 'Pro';
    return 'Basic';
  }

  getMemberSince(): string {
    try {
      const decodedToken = this.authService.getDecodedToken();
      if (!decodedToken) return 'Unknown';
      
      // If the token has an 'iat' (issued at) claim
      if (decodedToken.iat) {
        const date = new Date(decodedToken.iat * 1000);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      
      // Fallback: use current date
      return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (error) {
      return 'Unknown';
    }
  }

  getLastLoginTime(): string {
    const loginTime = localStorage.getItem('lastLoginTime');
    
    if (loginTime) {
      try {
        // Calculate time difference
        const loginDate = new Date(loginTime);
        const now = new Date();
        const diffMs = now.getTime() - loginDate.getTime();
        const diffMins = Math.round(diffMs / 60000); // minutes
        const diffHrs = Math.round(diffMs / 3600000); // hours
        const diffDays = Math.round(diffMs / 86400000); // days
        
        if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        if (diffHrs < 24) return `${diffHrs} ${diffHrs === 1 ? 'hour' : 'hours'} ago`;
        if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        
        // If more than a month, show the date
        return loginDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      } catch (error) {
        return 'Recently';
      }
    }
    
    return 'Recently';
  }
}