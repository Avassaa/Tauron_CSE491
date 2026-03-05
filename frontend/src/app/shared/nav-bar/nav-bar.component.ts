import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Router } from "@angular/router";
import { AuthService } from '../../services/auth.service';

@Component({
  selector: "nav-bar",
  imports: [RouterModule, CommonModule],
  templateUrl: "./nav-bar.component.html",
  styleUrl: "./nav-bar.component.scss",
})
export class NavBarComponent {
  constructor(public authService: AuthService, private router: Router) {} 

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
