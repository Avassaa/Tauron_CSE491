import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  publishDate: string;
  author: string | null;
  imageUrl: string | null;
}

export interface NewsResponse {
  pageNumber: number;
  pageSize: number;
  data: NewsItem[];
}

export interface NewsDetail {
  succeeded: boolean;
  message: string | null;
  errors: any | null;
  data: {
    id: number;
    title: string;
    content: string;
    publishDate: string;
    createdBy: string | null;
    created: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private apiUrl = `${environment.apiUrl}/v1/News`;

  constructor(private http: HttpClient) { }

  getNews(pageNumber: number = 1, pageSize: number = 10): Observable<NewsResponse> {
    const params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    return this.http.get<NewsResponse>(this.apiUrl, { params });
  }

  getNewsById(id: number): Observable<NewsDetail> {
    return this.http.get<NewsDetail>(`${this.apiUrl}/${id}`);
  }

  createNews(news: Partial<NewsItem>): Observable<number> {
    return this.http.post<number>(this.apiUrl, news);
  }

  updateNews(id: number, news: Partial<NewsItem>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, news);
  }

  deleteNews(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}