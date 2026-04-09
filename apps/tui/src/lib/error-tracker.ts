export interface TrackedError {
  timestamp: string;
  status: number;
  route: string;
  message: string;
  payload: unknown;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private maxErrors = 10;

  record(error: TrackedError) {
    this.errors.unshift(error);
    if (this.errors.length > this.maxErrors) this.errors.pop();
  }

  getRecent(): TrackedError[] {
    return [...this.errors];
  }

  clear() {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();
