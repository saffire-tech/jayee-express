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

interface Props {
  ownerName?: string
  storeName?: string
  dashboardUrl?: string
}

const Email = ({ ownerName, storeName, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Jayee Express store is live — welcome aboard!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>Jayee Express</Text>
        </Section>
        <Heading style={h1}>Welcome{ownerName ? `, ${ownerName}` : ''} 🎉</Heading>
        <Text style={text}>
          Your store <strong>{storeName || 'on Jayee Express'}</strong> has been created
          and submitted for admin review. Once approved, buyers in your city will be able
          to discover your products and place orders straight from the app.
        </Text>
        <Text style={text}>
          While you wait, you can start adding products, set your delivery preferences,
          and complete your payout details from your seller dashboard.
        </Text>
        <Button style={button} href={dashboardUrl || 'https://jayeeexpress.com/seller'}>
          Open Seller Dashboard
        </Button>
        <Text style={tips}>
          <strong>Quick tips</strong><br />
          • Add clear photos and honest prices in Ghana Cedis (₵).<br />
          • Keep stock levels updated so buyers don't order unavailable items.<br />
          • Reply to messages quickly — fast sellers rank higher.
        </Text>
        <Text style={footer}>
          Need help? Reply to this email or visit the Help Center in the app.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    d?.storeName
      ? `Welcome to Jayee Express, ${d.storeName}!`
      : 'Welcome to Jayee Express!',
  displayName: 'Store welcome',
  previewData: {
    ownerName: 'Ama',
    storeName: 'Ama Fresh Foods',
    dashboardUrl: 'https://jayeeexpress.com/seller',
  },
} satisfies TemplateEntry<Props>

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
}
const container = { padding: '24px 28px', maxWidth: '560px' }
const brandBar = { padding: '0 0 16px' }
const brand = { color: '#F97316', fontWeight: 'bold' as const, fontSize: '18px', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#111111', margin: '4px 0 18px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 18px' }
const button = {
  backgroundColor: '#F97316',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '12px',
  padding: '12px 22px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const tips = {
  fontSize: '13px',
  color: '#444',
  lineHeight: '1.7',
  margin: '28px 0 0',
  padding: '14px 16px',
  backgroundColor: '#FFF7ED',
  borderRadius: '12px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
