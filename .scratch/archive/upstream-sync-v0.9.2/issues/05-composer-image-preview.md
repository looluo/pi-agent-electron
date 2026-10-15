# Issue 05: composer-image-preview

Type: task
Status: resolved
Blocked by: —

d2056b6 (#735): attachment thumbnails in the composer open the shared
ImagePreview lightbox; remove button split out (type="button").

## Answer

Resolved. port-patch clean; our ImagePreview component already matched
upstream's. Gate: ImagePreview suite green (5 tests).
