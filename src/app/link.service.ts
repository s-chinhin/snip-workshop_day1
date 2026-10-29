import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ShortLink {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinkService {
  // On the ng serve dev server (:4200) the API runs separately on :3000; in the
  // release bundle the same Bun process serves both, so use the page's own origin.
  private readonly endpoint =
    window.location.port === '4200' ? 'http://localhost:3000/api/links' : '/api/links';

  constructor(private readonly http: HttpClient) {}

  listLinks(): Observable<ShortLink[]> {
    return this.http.get<ShortLink[]>(this.endpoint);
  }

  createLink(url: string): Observable<ShortLink> {
    return this.http.post<ShortLink>(this.endpoint, { url });
  }
}