import {
  Boxes,
  CalendarDays,
  ClipboardList,
  HardHat,
  LayoutDashboard,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Owner', 'Dispatcher'], end: true },
  { to: '/jobs', label: 'Jobs', icon: ClipboardList, roles: ['Owner', 'Dispatcher'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['Owner', 'Dispatcher'] },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['Owner', 'Dispatcher'] },
  { to: '/equipment', label: 'Equipment', icon: Wrench, roles: ['Owner', 'Dispatcher'] },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: ['Owner', 'Dispatcher'] },
  { to: '/my-jobs', label: 'My Jobs', icon: HardHat, roles: ['Technician'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['Owner'] },
]

export function navFor(roles: Role[]) {
  return NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)))
}
