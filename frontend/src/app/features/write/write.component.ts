// write.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NewsService, NewsItem } from '../../services/news.service';

@Component({
  selector: 'app-write',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './write.component.html',
  styleUrls: ['./write.component.scss']
})
export class WriteComponent implements OnInit {
  newsForm!: FormGroup;
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;

  constructor(
    private fb: FormBuilder,
    private newsService: NewsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.newsForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      content: ['', [Validators.required, Validators.minLength(20)]],
      author: ['', Validators.required],
      publishDate: [this.formatDate(new Date()), Validators.required],
      imageUrl: ['']
    });
  }

  formatDate(date: Date): string {
    // Format date as YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  submitNews(): void {
    if (this.newsForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.newsForm.controls).forEach(key => {
        const control = this.newsForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const newsData: Partial<NewsItem> = {
      ...this.newsForm.value,
      publishDate: new Date(this.newsForm.value.publishDate).toISOString()
    };

    this.newsService.createNews(newsData).subscribe({
      next: (newsId) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        
        // Reset form after successful submission
        this.newsForm.reset();
        this.newsForm.patchValue({
          publishDate: this.formatDate(new Date())
        });
        
        // Redirect to news page after a delay
        setTimeout(() => {
          this.submitSuccess = false;
          this.router.navigate(['/news']);
        }, 2000);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitError = 'Failed to create news article. Please try again.';
        console.error('Error creating news:', error);
      }
    });
  }

  // Helper methods for form validation
  get titleControl() { return this.newsForm.get('title'); }
  get contentControl() { return this.newsForm.get('content'); }
  get authorControl() { return this.newsForm.get('author'); }
}