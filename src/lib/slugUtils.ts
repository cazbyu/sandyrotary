export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80) +
    '-' +
    Date.now().toString(36)
  );
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export async function shareContent(title: string, text: string, url: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await fallbackCopyToClipboard(text, url);
      }
    }
  } else {
    await fallbackCopyToClipboard(text, url);
  }
}

async function fallbackCopyToClipboard(text: string, url: string): Promise<void> {
  await navigator.clipboard.writeText(`${text}\n${url}`);
  alert('Copied to clipboard!');
}
