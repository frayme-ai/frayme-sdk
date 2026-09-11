/**
 * HEADING OUTLINE — the levels components emit when the spec says nothing.
 *
 * These defaults have moved twice in one day (Carousel h4 → h3 → h2), each time
 * to close a skip measured on the render, and nothing pinned them: the a11y
 * audit runs against a BUILT runtime, so a source edit could silently undo the
 * fix and only surface in an audit later. The rule they encode:
 *
 *   PageHeader h1  →  a FRAME (Card, Carousel) h2  →  CONTENT inside a frame
 *   (EmptyState, ErrorState, FeatureCard) h3
 *
 * and every one of them yields to an authored `titleLevel`, because a component
 * cannot know its own depth in the page.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FraymeRenderer } from '../src/react/FraymeRenderer.js';

const one = (type: string, props: Record<string, unknown>) => ({
  root: 'x',
  elements: { x: { type, props } },
});
const draw = (type: string, props: Record<string, unknown>) =>
  render(<FraymeRenderer spec={one(type, props) as never} mode="progressive" />).container;

const tags = (c: Element) => [...c.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => h.tagName);

describe('heading defaults', () => {
  it('Carousel item titles default h2 and honour titleLevel', () => {
    const items = [{ title: 'A' }, { title: 'B' }];
    expect(tags(draw('Carousel', { items }))).toEqual(['H2', 'H2']);
    expect(tags(draw('Carousel', { items, titleLevel: 'h3' }))).toEqual(['H3', 'H3']);
    expect(tags(draw('Carousel', { items, titleLevel: 4 }))).toEqual(['H4', 'H4']);
  });

  it('EmptyState / ErrorState keep h3 and honour titleLevel', () => {
    expect(tags(draw('EmptyState', { title: 'None' }))).toEqual(['H3']);
    expect(tags(draw('EmptyState', { title: 'None', titleLevel: 'h2' }))).toEqual(['H2']);
    expect(tags(draw('ErrorState', { title: 'Boom' }))).toEqual(['H3']);
    expect(tags(draw('ErrorState', { title: 'Boom', titleLevel: 2 }))).toEqual(['H2']);
  });

  it('FeatureCard and FeatureGrid keep h3 and honour titleLevel', () => {
    expect(tags(draw('FeatureCard', { title: 'F' }))).toEqual(['H3']);
    expect(tags(draw('FeatureCard', { title: 'F', titleLevel: 'h2' }))).toEqual(['H2']);
    const features = [{ title: 'A' }, { title: 'B' }];
    expect(tags(draw('FeatureGrid', { features }))).toEqual(['H3', 'H3']);
    expect(tags(draw('FeatureGrid', { features, titleLevel: 'h2' }))).toEqual(['H2', 'H2']);
  });

  it('Card stays h2 and PageHeader stays h1 (the chain this follows)', () => {
    expect(tags(draw('Card', { title: 'C' }))).toEqual(['H2']);
    expect(tags(draw('PageHeader', { title: 'P' }))).toEqual(['H1']);
  });

  it('an unusable titleLevel falls back rather than emitting an invalid tag', () => {
    expect(tags(draw('Carousel', { items: [{ title: 'A' }], titleLevel: 'h9' }))).toEqual(['H2']);
    expect(tags(draw('EmptyState', { title: 'None', titleLevel: 'nonsense' }))).toEqual(['H3']);
  });
});
