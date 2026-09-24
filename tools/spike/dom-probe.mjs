const PROBE_SOURCE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function runThumbnailDomProbe(image, candidate = PROBE_SOURCE) {
  const original = image.getAttribute('src');
  let fallbackObserved = false;
  const fallback = () => {
    fallbackObserved = true;
    if (original === null) image.removeAttribute('src');
    else image.setAttribute('src', original);
  };

  image.setAttribute('src', candidate);
  const mutationObserved = image.getAttribute('src') === candidate;
  fallback();
  const restored = image.getAttribute('src') === original;

  return { mutationObserved, fallbackObserved, restored };
}

export { PROBE_SOURCE };
