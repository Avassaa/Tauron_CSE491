# Tauron Frontend

Angular 17 frontend application for the Tauron project.

## Overview

This is the frontend application built with Angular 17, featuring a modern, responsive UI that communicates with the FastAPI backend service.

## Features

- Modern Angular 17 architecture with standalone components
- TypeScript for type safety
- HTTP client service for API communication
- Environment-based configuration
- Responsive design

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher) or yarn

## Installation

```bash
npm install
```

## Development

Start the development server:

```bash
ng serve
# or
npm start
```

The application will be available at `http://localhost:4200`.

The app will automatically reload if you change any of the source files.

## Project Structure

```
src/
├── app/
│   ├── components/     # Reusable UI components
│   ├── services/       # Angular services (API, auth, etc.)
│   ├── models/         # TypeScript interfaces and models
│   ├── guards/         # Route guards for authentication
│   ├── interceptors/   # HTTP interceptors
│   ├── utils/          # Utility functions
│   └── app.component.ts
├── assets/             # Static assets (images, styles)
├── environments/       # Environment configurations
│   ├── environment.ts           # Development
│   └── environment.prod.ts      # Production
├── index.html
├── main.ts            # Application entry point
└── styles.css         # Global styles
```

## Configuration

### Environment Variables

Update `src/environments/environment.ts` for development:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1'
};
```

For production, update `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.tauron.com/api/v1'
};
```

## Building

### Development Build

```bash
ng build
```

### Production Build

```bash
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

## Running Unit Tests

```bash
ng test
```

Tests are executed via [Karma](https://karma-runner.github.io).

## Code Generation

Generate a new component:

```bash
ng generate component component-name
```

Generate a new service:

```bash
ng generate service service-name
```

## Key Services

### ApiService

Located at `src/app/services/api.service.ts`, this service provides HTTP methods for communicating with the backend API:

```typescript
// GET request
this.apiService.get<User>('/users/1').subscribe(user => {
  console.log(user);
});

// POST request
this.apiService.post<User>('/users', userData).subscribe(user => {
  console.log(user);
});
```

## API Integration

The frontend communicates with the backend API running on `http://localhost:8000`. Ensure the backend service is running before starting the frontend.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Port Already in Use

If port 4200 is already in use:

```bash
ng serve --port 4201
```

### Module Not Found Errors

Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Additional Resources

- [Angular Documentation](https://angular.io/docs)
- [Angular CLI Documentation](https://angular.io/cli)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
