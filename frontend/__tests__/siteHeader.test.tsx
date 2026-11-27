import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteHeader } from '../components/SiteHeader';
import { useAuthStore } from '../stores/authStore';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('SiteHeader role-based navigation', () => {
  beforeEach(() => {
    mockPathname = '/';
    useAuthStore.getState().logout();
  });

  it('shows public nav (Home, Services, About Us) without Book a session or Dashboard when logged out on /', () => {
    mockPathname = '/';
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About Us' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Book a session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Workspace:/i)).not.toBeInTheDocument();
  });

  it.each([
    { role: 'client' as const, expectedHref: '/bookings' },
    { role: 'psychologist' as const, expectedHref: '/psych/queue' },
    { role: 'admin' as const, expectedHref: '/admin/users' },
  ])('shows Dashboard tab on / for logged-in $role pointing to $expectedHref', ({ role, expectedHref }) => {
    mockPathname = '/';
    useAuthStore.setState({
      isAuthenticated: true,
      user: { username: 'user1', email: 'u@example.com', role, cognitoSub: '1' },
    });
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', expectedHref);
  });

  it('shows Bookings and Profiles for client on /bookings with logo left and account right', () => {
    mockPathname = '/bookings';
    useAuthStore.setState({
      isAuthenticated: true,
      user: { username: 'client1', email: 'c@example.com', role: 'client', cognitoSub: '1' },
    });
    render(<SiteHeader />);

    const logo = screen.getByAltText('PsychAve PH logo');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
    expect(screen.queryByText('PSYCHAVE PH')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Bookings' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Profiles' })[0]).toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText(/Book a session/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /client1/i }));
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
  });

  it('shows Pending Bookings and Schedule for psychologist and links Account Management to /psych/profile', () => {
    mockPathname = '/psych/queue';
    useAuthStore.setState({
      isAuthenticated: true,
      user: { username: 'dr1', email: 'dr@example.com', role: 'psychologist', cognitoSub: '2' },
    });
    render(<SiteHeader />);

    expect(screen.getAllByRole('link', { name: 'Pending Bookings' })[0]).toHaveAttribute('href', '/psych/queue');
    expect(screen.getAllByRole('link', { name: 'Schedule' })[0]).toHaveAttribute('href', '/psych/schedule');

    fireEvent.click(screen.getByRole('button', { name: /dr1/i }));
    expect(screen.getByRole('link', { name: 'Account Management' })).toHaveAttribute('href', '/psych/profile');
  });

  it('shows Users, Payments & Refunds, and CMS for admin', () => {
    mockPathname = '/admin/users';
    useAuthStore.setState({
      isAuthenticated: true,
      user: { username: 'admin1', email: 'a@example.com', role: 'admin', cognitoSub: '3' },
    });
    render(<SiteHeader />);

    expect(screen.getAllByRole('link', { name: 'Users' })[0]).toHaveAttribute('href', '/admin/users');
    expect(screen.getAllByRole('link', { name: 'Users' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Payments & Refunds' })[0]).toHaveAttribute('href', '/admin/bookings');
    expect(screen.getAllByRole('link', { name: 'CMS' })[0]).toHaveAttribute('href', '/admin/cms');

    fireEvent.click(screen.getByRole('button', { name: /admin1/i }));
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
  });
});
