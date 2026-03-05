// news.component.ts
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NewsService, NewsItem } from "../../services/news.service";
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: "app-news",
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterModule],
  templateUrl: "./news.component.html",
  styleUrl: "./news.component.scss",
})
export class NewsComponent implements OnInit {
  // News items from API
  newsItems: NewsItem[] = [];
  featuredNews: NewsItem | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalItems = 0;
  
  // Loading and error states
  isLoading = false;
  errorMessage: string | null = null;
  
  // Newsletter
  emailSubscription = '';
  subscriptionSuccess = false;

  constructor(private newsService: NewsService) {}

  ngOnInit(): void {
    this.loadNews();
  }

  loadNews(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.newsService.getNews(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.newsItems = response.data;
        
        // Set the first news item as featured, if available
        if (response.data.length > 0) {
          this.featuredNews = response.data[0];
          // Remove the featured news from the regular list
          this.newsItems = this.newsItems.slice(1);
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load news. Please try again later.';
        console.error('Error loading news:', error);
        this.isLoading = false;
      }
    });
  }

  changePage(newPage: number): void {
    this.currentPage = newPage;
    this.loadNews();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    return new Date(dateString).toLocaleDateString('en-US', options);
  }
  
  getImageUrl(newsItem: NewsItem): string {
    // Return the image URL if available, otherwise use a placeholder
    return newsItem && newsItem.imageUrl ? newsItem.imageUrl : '/assets/images/news.jpg';
  }
  
  // This would typically call an API to handle newsletter subscriptions
  subscribeToNewsletter(): void {
    if (!this.emailSubscription || !this.validateEmail(this.emailSubscription)) {
      return;
    }
    
    // Here you would call an API endpoint to handle the subscription
    // For now, just simulate success
    this.subscriptionSuccess = true;
    this.emailSubscription = '';
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      this.subscriptionSuccess = false;
    }, 3000);
  }
  
  validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  truncateContent(content: string, maxLength: number = 150): string {
    if (!content) return '';
    return content.length > maxLength ? 
      content.substring(0, maxLength) + '...' : content;
  }
}