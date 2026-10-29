import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { LinkService, ShortLink } from './link.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly links = signal<ShortLink[]>([]);
  readonly url = signal('');
  readonly createdLink = signal<ShortLink | null>(null);
  readonly formError = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
  readonly isCreating = signal(false);
  readonly isRefreshing = signal(false);

  constructor(private readonly linkService: LinkService) {}

  ngOnInit(): void {
    this.refreshLinks();
  }

  updateUrl(event: Event): void {
    this.url.set((event.target as HTMLInputElement).value);
    this.formError.set(null);
    this.createdLink.set(null);
  }

  createLink(): void {
    const value = this.url().trim();
    let parsedUrl: URL;

    this.formError.set(null);
    this.createdLink.set(null);

    try {
      parsedUrl = new URL(value);
    } catch {
      this.formError.set('Enter a valid HTTP or HTTPS URL.');
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      this.formError.set('Only HTTP and HTTPS links can be shortened.');
      return;
    }

    this.isCreating.set(true);
    this.linkService.createLink(parsedUrl.href).subscribe({
      next: (link) => {
        this.createdLink.set(link);
        this.url.set('');
        this.isCreating.set(false);
        this.refreshLinks();
      },
      error: (error: unknown) => {
        this.formError.set(this.getErrorMessage(error));
        this.isCreating.set(false);
      },
    });
  }

  refreshLinks(): void {
    this.isRefreshing.set(true);
    this.listError.set(null);
    this.linkService.listLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.isRefreshing.set(false);
      },
      error: (error: unknown) => {
        this.listError.set(this.getErrorMessage(error));
        this.isRefreshing.set(false);
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { error?: unknown } | null)?.error;
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'Could not reach the Snip API.';
      return `The request failed (${error.status}). Please try again.`;
    }

    return 'Something went wrong. Please try again.';
  }
}
