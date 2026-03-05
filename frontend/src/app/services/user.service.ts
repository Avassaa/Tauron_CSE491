import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/Account`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getUserDetails(): Observable<any> {
    return this.http.get(`${this.apiUrl}/details`, { headers: this.getHeaders() });
  }

  updateUserDetails(userDetails: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/details`, userDetails, { headers: this.getHeaders() });
  }

  forgotPassword(email: string): Observable<any> {
    const body = { email };
    return this.http.post(`${this.apiUrl}/forgot-password`, body, { headers: this.getHeaders() });
  }
  
  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/details`, { 
      headers: this.getHeaders(),
      responseType: 'text'  // The API might return plain text
    });
  }

  changePassword(passwordData: any): Observable<any> {
    const formattedData = {
      email: passwordData.email,
      token: passwordData.token,
      password: passwordData.password,
      confirmPassword: passwordData.confirmPassword
    };
    
    return this.http.post(`${this.apiUrl}/reset-password`, formattedData, {
      headers: this.getHeaders(),
      responseType: 'text'
    });
  }
}