import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ status: 'approved' }),
    ]);

    // Compute average rating
    const ratingAgg = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const avgRating = ratingAgg[0]?.avg ? Number(ratingAgg[0].avg.toFixed(1)) : 0;
    const ratingCount = ratingAgg[0]?.count || 0;

    return NextResponse.json({
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
      avgRating,
      ratingCount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Sign in to write a review' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { rating, comment, roomId } = body;

    if (!rating || !comment) {
      return NextResponse.json({ error: 'Rating and comment are required' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }
    if (comment.trim().length < 10) {
      return NextResponse.json({ error: 'Comment must be at least 10 characters' }, { status: 400 });
    }

    const review = await Review.create({
      userEmail: session.user.email,
      userName: session.user.name,
      rating: Number(rating),
      comment: comment.trim(),
      roomId: roomId || null,
      status: 'pending',
    });

    return NextResponse.json({
      review,
      message: 'Review submitted! It will appear after admin approval.',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
