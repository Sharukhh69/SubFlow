import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthenticated requests
    }

    if (user.forcePasswordChange) {
      const path = request.path || request.url;
      // Allow change-password and logout paths even when forcePasswordChange is true
      if (path.includes('/auth/change-password') || path.includes('/auth/logout')) {
        return true;
      }

      throw new ForbiddenException({
        statusCode: 403,
        message: 'Password change required before accessing this resource',
        requiresPasswordChange: true,
      });
    }

    return true;
  }
}

