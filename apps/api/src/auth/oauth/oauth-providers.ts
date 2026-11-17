import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isOAuthProvider, type OAuthProviderId } from '@sds/shared';
import { APP_CONFIG, type AppConfig } from '../../config.js';
import { GithubProvider } from './github.provider.js';
import { GoogleProvider } from './google.provider.js';
import type { OAuthProvider } from './oauth-provider.js';

@Injectable()
export class OAuthProviders {
  private readonly providers = new Map<OAuthProviderId, OAuthProvider>();

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { github, google } = config.oauth;
    if (github) this.providers.set('github', new GithubProvider(github));
    if (google) this.providers.set('google', new GoogleProvider(google));
  }

  get(id: string): OAuthProvider {
    const provider = isOAuthProvider(id) ? this.providers.get(id) : undefined;
    if (!provider) throw new NotFoundException('Unknown sign-in provider');
    return provider;
  }

  available(): OAuthProviderId[] {
    return [...this.providers.keys()];
  }
}
