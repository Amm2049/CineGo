// src/types/index.ts
// CineGo -- Shared TypeScript interfaces and type definitions

import { Movie, Genre, Showtime, Screen } from "@prisma/client";

export type MovieWithRelations = Movie & {
  genres: {
    genre: Genre;
  }[];
  showtimes?: (Showtime & {
    screen?: Screen;
  })[];
};

export interface MovieRecommendation {
  movieId: string;
  matchScore: number;
  reason: string;
}

export type RecommendationMap = Record<string, MovieRecommendation>;

export interface MovieCardProps {
  id: string;
  title: string;
  posterUrl: string;
  backdropUrl?: string;
  duration: number;
  releaseDate: Date | string;
  genres: string[];
  formats?: string[];
  matchScore?: number;
  matchReason?: string;
  isUpcoming?: boolean;
  priority?: boolean;
}

export interface GenrePreferenceItem {
  id: string;
  name: string;
  selected: boolean;
}

export interface SpotlightMovie {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  posterUrl: string;
  duration: number;
  genres: string[];
  formats: string[];
}

export interface MovieItem {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  duration: number;
  releaseDate: string;
  genres: string[];
  formats: string[];
  isUpcoming: boolean;
  matchScore?: number;
  matchReason?: string;
}
