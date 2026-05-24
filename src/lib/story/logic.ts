import { FlyToInterpolator } from '@deck.gl/core';

export const cinematicFlyTo = (viewState: any, target: { longitude: number, latitude: number, zoom: number }) => {
  return {
    ...viewState,
    ...target,
    transitionDuration: 3000,
    transitionInterpolator: new FlyToInterpolator(),
    // Custom easing for a more "cinematic" feel
    transitionEasing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  };
};

export const STORY_EVENTS = [
  {
    id: 'amazon-fire-2021',
    title: 'Major Wildfire Event',
    description: 'In August 2021, a massive wildfire swept through this sector, destroying 450 hectares of primary forest.',
    coordinates: { longitude: -62.2159, latitude: -3.4653, zoom: 12 },
    date: '2021-08-15',
    impactMetric: '450ha Lost'
  },
  {
    id: 'amazon-recovery-2023',
    title: 'Signs of Regeneration',
    description: 'By early 2023, high-resolution analysis shows the first significant signs of natural forest regeneration.',
    coordinates: { longitude: -62.2200, latitude: -3.4700, zoom: 13 },
    date: '2023-03-01',
    impactMetric: '+12% Green Cover'
  }
];
