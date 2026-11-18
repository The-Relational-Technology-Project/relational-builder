import { describe, expect, it } from 'vitest';
import { describeResourceFailures, parseResourceFailures } from './resource-failures';
import { RESOURCE_RELAY } from './bundler/shell';

describe('pictures the preview did not get', () => {
  it('keeps well-formed entries and drops anything else the app window sends', () => {
    expect(
      parseResourceFailures([
        { host: 'tile.openstreetmap.org', count: 12.9, status: 403 },
        { host: '<img onerror=x>', count: 1, status: 0 },
        { host: 'example.org', count: 0, status: 404 },
        { host: 'example.org', count: 2 },
        null,
        'nope',
      ]),
    ).toEqual([
      { host: 'tile.openstreetmap.org', count: 12, status: 403 },
      { host: 'example.org', count: 2, status: 0 },
    ]);
    expect(parseResourceFailures('nope')).toEqual([]);
  });

  it('counts a map service once, however many tile subdomains it uses', () => {
    expect(
      parseResourceFailures([
        { host: 'a.tile.openstreetmap.org', count: 4, status: 403 },
        { host: 'b.tile.openstreetmap.org', count: 4, status: 403 },
        { host: 'c.tile.openstreetmap.org', count: 4, status: 403 },
      ]),
    ).toEqual([{ host: 'tile.openstreetmap.org', count: 12, status: 403 }]);
  });

  it('says it in plain words', () => {
    expect(
      describeResourceFailures([
        { host: 'tile.openstreetmap.org', count: 12, status: 403 },
        { host: 'example.org', count: 1, status: 404 },
        { host: 'photos.example', count: 3, status: 0 },
      ]),
    ).toBe('tile.openstreetmap.org: 12 refused (403), example.org: 1 missing (404), photos.example: 3 failed');
  });

  it('ships a relay script that parses', () => {
    const js = RESOURCE_RELAY.replace(/^<script>/, '').replace(/<\/script>$/, '');
    expect(() => new Function(js)).not.toThrow();
  });
});
