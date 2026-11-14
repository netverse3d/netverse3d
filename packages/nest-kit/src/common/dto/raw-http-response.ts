export class RawHttpResponse<T = unknown> {
  constructor(
    public readonly status: number,
    public readonly body: T,
  ) {}
}
