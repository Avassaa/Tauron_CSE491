// news-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NewsService, NewsDetail } from '../../services/news.service';

@Component({
  selector: 'app-news-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-5 text-white">
      <div class="text-center my-5" *ngIf="isLoading">
        <div class="spinner-border text-light" role="status">
          <span class="visually-hidden">Loading article...</span>
        </div>
      </div>
      
      <div class="alert alert-danger" *ngIf="error">
        {{ error }}
        <button class="btn btn-sm btn-outline-light ms-3" (click)="goBack()">Go Back</button>
      </div>
      
      <div *ngIf="!isLoading && !error && newsDetail">
        <div class="mb-4">
          <button class="btn btn-outline-light" (click)="goBack()">
            <i class="bi bi-arrow-left me-2"></i>Back to News
          </button>
        </div>
        
        <div class="card bg-dark text-white border border-secondary">
          <div class="card-header bg-dark border-secondary d-flex justify-content-between align-items-center">
            <div>
              <h1 class="mb-0">{{ newsDetail.data.title }}</h1>
              <small class="text-muted">
                Published: {{ formatDate(newsDetail.data.publishDate) }}
                <span *ngIf="newsDetail.data.createdBy"> by {{ newsDetail.data.createdBy }}</span>
              </small>
            </div>
          </div>
          
          <div class="card-body">
            <div class="mb-4" *ngIf="newsImage">
              <img [src]="newsImage" class="img-fluid rounded" alt="Article image">
            </div>
            
            <div class="article-content">
              <p>{{ newsDetail.data.content }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .article-content {
      font-size: 1.1rem;
      line-height: 1.7;
    }
  `]
})
export class NewsDetailComponent implements OnInit {
  newsDetail: NewsDetail | null = null;
  isLoading = false;
  error: string | null = null;
  newsImage: string | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private newsService: NewsService
  ) { }
  
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.loadNewsDetail(id);
      } else {
        this.error = 'Invalid news article ID';
      }
    });
  }
  
  loadNewsDetail(id: number): void {
    this.isLoading = true;
    this.error = null;
    
    this.newsService.getNewsById(id).subscribe({
      next: (response) => {
        if (response.succeeded) {
          this.newsDetail = response;
          // Set a default image based on ID if none provided
          this.newsImage = '/assets/images/news.jpg'; 
        } else {
          this.error = response.message || 'Failed to load article';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error loading article: ' + (err.message || 'Unknown error');
        this.isLoading = false;
      }
    });
  }
  
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(dateString).toLocaleString('en-US', options);
  }
  
  goBack(): void {
    this.router.navigate(['/news']);
  }
}