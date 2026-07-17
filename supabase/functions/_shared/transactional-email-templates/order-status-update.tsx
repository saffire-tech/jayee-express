/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled' | string

interface Props {
  buyerName?: string
  orderId?: string
  status?: Status
  storeName?: string
  orderUrl?: string
}

const STATUS_COPY: Record<string, { title: string; body: string; badge: string }> = {
  pending: {
    title: 'Order received',
    body: 'Your order has been received and is awaiting the seller\'s confirmation.',
    badge: '#F59E0B',
  },
  confirmed: {
    title: 'Order confirmed',
    body: 'Good news! The seller has confirmed your order and it\'s being prepared.',
    badge: '#3B82F6',
  },
  completed: {
    title: 'Order completed',
    body: 'Your order is marked as completed. We hope you enjoy your purchase!',
    badge: '#16A34A',
  },
  cancelled: {
    title: 'Order cancelled',
    body: 'Your order has been cancelled. If you were charged, a refund will be processed to your wallet.',
    badge: '#DC2626',
  },
}

const Email = ({ buyerName, orderId, status, storeName, orderUrl }: Props) => {
  const key = (status || 'pending').toLowerCase()
  const copy = STATUS_COPY[key] || STATUS_COPY.pending
  const shortId = orderId ? orderId.substring(0, 8).toUpperCase() : ''
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copy.title}{shortId ? ` — Order #${shortId}` : ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brand}>Jayee Express</Text>
          </Section>
          <Heading style={h1}>{copy.title}</Heading>
          <Text style={text}>Hi {buyerName || 'there'},</Text>
          <Text style={text}>
            {copy.body}
          </Text>
          <Section style={{ margin: '18px 0 22px' }}>
            <Text style={metaRow}><strong>Store:</strong> {storeName || 'Store'}</Text>
            {shortId ? <Text style={metaRow}><strong>Order:</strong> #{shortId}</Text> : null}
            <Text style={metaRow}>
              <strong>Status:</strong>{' '}
              <span style={{ ...badge, backgroundColor: copy.badge }}>
                {(status || 'pending').toUpperCase()}
              </span>
            </Text>
          </Section>
          <Button style={button} href={orderUrl || 'https://jayeeexpress.com/purchases'}>
            View Order
          </Button>
          <Text style={footer}>
            You're receiving this because you placed an order on Jayee Express.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => {
    const key = (d?.status || 'pending').toLowerCase()
    const copy = STATUS_COPY[key] || STATUS_COPY.pending
    const shortId = d?.orderId ? d.orderId.substring(0, 8).toUpperCase() : ''
    return shortId ? `${copy.title} — Order #${shortId}` : copy.title
  },
  displayName: 'Order status update',
  previewData: {
    buyerName: 'Kwame',
    orderId: 'a1b2c3d4-1234-5678',
    status: 'confirmed',
    storeName: 'Ama Fresh Foods',
    orderUrl: 'https://jayeeexpress.com/purchases',
  },
} satisfies TemplateEntry<Props>

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
}
const container = { padding: '24px 28px', maxWidth: '560px' }
const brandBar = { padding: '0 0 16px' }
const brand = { color: '#F97316', fontWeight: 'bold' as const, fontSize: '18px', margin: 0 }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111111', margin: '4px 0 14px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 14px' }
const metaRow = { fontSize: '14px', color: '#444', margin: '4px 0' }
const badge = {
  color: '#ffffff',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
}
const button = {
  backgroundColor: '#F97316',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '12px',
  padding: '12px 22px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
