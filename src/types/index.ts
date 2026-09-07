// ============================================================
// CineGo — Shared TypeScript Type Definitions
// ============================================================

// ------ Enums ------

export type Role = 'CUSTOMER' | 'ADMIN';
export type BookingStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type PaymentStatus = 'SUCCESS' | 'FAILED';
export type TicketStatus = 'ACTIVE' | 'USED';
export type SeatAvailability = 'AVAILABLE' | 'HELD' | 'BOOKED';

// ------ Domain Entities ------

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface Genre {
  id: string;
  name: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  releaseDate: Date;
  imageUrl: string;
  genres: Genre[];
}

export interface Cinema {
  id: string;
  name: string;
  location: string;
}

export interface Screen {
  id: string;
  cinemaId: string;
  name: string;
}

export interface Seat {
  id: string;
  screenId: string;
  rowLabel: string;
  seatNum: number;
  price: number;
  availability?: SeatAvailability;
}

export interface Showtime {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: Date;
  endsAt: Date;
  movie?: Movie;
  screen?: Screen;
}

export interface Booking {
  id: string;
  userId: string;
  showtimeId: string;
  status: BookingStatus;
  totalAmount: number;
  createdAt: Date;
  seats?: BookingSeat[];
}

export interface BookingSeat {
  id: string;
  bookingId: string;
  showtimeId: string;
  seatId: string;
  priceAtPurchase: number;
  heldUntil?: Date;
  seat?: Seat;
}

export interface Payment {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  amount: number;
  transactionReference: string;
  paidAt: Date;
}

export interface Ticket {
  id: string;
  bookingId: string;
  ticketCode: string;
  qrPayload: string;
  status: TicketStatus;
  issuedAt: Date;
}

// ------ API Response Types ------

export interface ApiError {
  error: string;
  message?: string;
}

export interface RecommendationItem {
  movieId: string;
  matchScore: number; // 0–100
  reason: string;     // 1-sentence AI explanation
}
