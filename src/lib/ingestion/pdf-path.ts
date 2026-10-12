/** Object path convention in the private bucket: `{seller_id}/{upload_id}.pdf`. */
export function pdfPath(sellerId: string, uploadId: string): string {
  return `${sellerId}/${uploadId}.pdf`;
}
