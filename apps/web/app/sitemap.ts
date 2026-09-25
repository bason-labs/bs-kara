import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/tv`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
