export interface ApiCall {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: string;
}

class ApiTracker {
  private calls: ApiCall[] = [];
  private maxCalls = 20;

  record(call: ApiCall) {
    this.calls.unshift(call);
    if (this.calls.length > this.maxCalls) this.calls.pop();
  }

  getRecent(): ApiCall[] {
    return [...this.calls];
  }

  clear() {
    this.calls = [];
  }
}

export const apiTracker = new ApiTracker();
