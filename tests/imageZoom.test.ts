import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_ZOOM_FACTOR, measureImageBaseWidth, zoomedImageWidth } from '../utils/imageZoom';

const fakeImg = (rendered: number, styleWidth: string, natural: number) =>
  ({
    getBoundingClientRect: () => ({ width: rendered }),
    style: { width: styleWidth },
    naturalWidth: natural,
  }) as unknown as HTMLImageElement;

describe('zoom obrazka', () => {
  test('podgląd ma 150% szerokości obrazu z kartki (zmienia wymiar, nie pozycję)', () => {
    assert.equal(IMAGE_ZOOM_FACTOR, 1.5);
    assert.equal(zoomedImageWidth(300), 450);
    assert.equal(zoomedImageWidth(333), 500);
  });

  test('nieznany rozmiar nie wymusza szerokości', () => {
    assert.equal(zoomedImageWidth(0), 0);
  });

  test('baza: najpierw wyrenderowana szerokość', () => {
    assert.equal(measureImageBaseWidth(fakeImg(300, '999px', 600)), 300);
  });

  test('baza dla załącznika (display:none): szerokość ze style, potem naturalna', () => {
    assert.equal(measureImageBaseWidth(fakeImg(0, '280px', 600)), 280);
    assert.equal(measureImageBaseWidth(fakeImg(0, '', 600)), 600);
  });
});
