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
  isUpcoming?: boolean;
  priority?: boolean;
  showtimeId?: string;
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
  showtimeId?: string;
}

// ── Phase 6: Seat Map & Live Booking Types ───────────────────

export type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED" | "SELECTED";
export type SeatTier = "VIP" | "PREMIUM" | "STANDARD";

export interface SeatLayoutItem {
  id: string;
  rowLabel: string;
  seatNum: number;
  price: number;
  tier: SeatTier;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  heldUntil: string | null;
  isHeldByMe?: boolean;
}

export interface ShowtimeSeatMapResponse {
  showtime: {
    id: string;
    startsAt: string;
    endsAt: string;
    movie: {
      id: string;
      title: string;
      posterUrl: string;
      duration: number;
      genres: string[];
    };
    screen: {
      id: string;
      name: string;
      format: string;
      cinemaName: string;
    };
  };
  seats: SeatLayoutItem[];
  pricing: {
    standard: number;
    premium: number;
    vip: number;
  };
  totalSeats: number;
  availableSeats: number;
}

export interface HoldSeatsRequest {
  seatIds: string[];
}

export interface HoldSeatsResponse {
  success: boolean;
  bookingId: string;
  heldUntil: string;
  heldSeatIds: string[];
  message?: string;
}

export interface ReleaseSeatsRequest {
  seatIds?: string[];
  bookingId?: string;
}


// ── Phase 7: Checkout, Payment & Digital Ticket Types ────────

export interface PaymentRequest {
  showtimeId: string;
}

export interface PaymentResponse {
  success: boolean;
  bookingId: string;
  ticketId: string;
  amount: number;
}

export interface TicketPass {
  id: string;
  ticketCode: string;
  qrPayload: string;
  status: "ACTIVE" | "USED";
  issuedAt: string;
  bookingReference: string;
  totalAmount: number;
  showtime: {
    startsAt: string;
    endsAt: string;
    screenName: string;
    screenNumber: number;
    screenFormat: string;
    cinemaName: string;
  };
  movie: {
    id: string;
    title: string;
    posterUrl: string;
    duration: number;
  };
  seats: {
    label: string;
    tier: SeatTier;
    price: number;
  }[];
}
