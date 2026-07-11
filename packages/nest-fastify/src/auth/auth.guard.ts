import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    if (request.headers.authorization !== "Bearer custom_token") {
      throw new UnauthorizedException();
    }
    return true;
  }
}
