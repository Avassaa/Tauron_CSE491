import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet],
    template: `
    <div class="app-container">
      <header>
        <h1>Tauron</h1>
      </header>
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
    styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background-color: #2c3e50;
      color: white;
      padding: 1rem;
    }
    main {
      flex: 1;
      padding: 2rem;
    }
  `]
})
export class AppComponent {
  title = 'Tauron';
}

