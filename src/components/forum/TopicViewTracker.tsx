'use client';
import { useEffect } from 'react';
import { recordTopicView } from '@/lib/actions/forum';

export function TopicViewTracker({ topicId }: { topicId: string }) {
  useEffect(() => { void recordTopicView(topicId); }, [topicId]);
  return null;
}
