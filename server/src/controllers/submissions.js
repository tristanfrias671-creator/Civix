const { PrismaClient } = require('@prisma/client');
const { generateTrackingId } = require('../utils/trackingId');
const { analyzeSentiment } = require('../utils/sentiment');
const { classifyText } = require('../utils/classifier');
const { sendSubmissionReceivedEmail, sendStatusUpdateEmail } = require('../utils/mailer');
const { configured: cloudinaryConfigured } = require('../utils/cloudinary');

const prisma = new PrismaClient();

function sentimentFromFeedback(rating) {
  if (rating >= 4) return 'POSITIVE';
  if (rating <= 2) return 'NEGATIVE';
  return 'NEUTRAL';
}

async function createSubmission(req, res) {
  try {
    const { type, citizenDepartment, description, rating, reaction, feedbackTags, contactNumber, email, address } = req.body;
    if (!type || !description) {
      return res.status(400).json({ error: 'type and description are required' });
    }
    if (!contactNumber?.trim()) {
      return res.status(400).json({ error: 'Contact number is required' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    let parsedRating = rating ? parseInt(rating, 10) : null;
    let parsedReaction = reaction || null;
    let parsedTags = null;

    if (type === 'FEEDBACK') {
      if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ error: 'Please select a rating from 1 to 5 stars for feedback' });
      }
      if (!parsedReaction) {
        return res.status(400).json({ error: 'Please select how you felt about the experience' });
      }
      if (feedbackTags) {
        try {
          const tags = typeof feedbackTags === 'string' ? JSON.parse(feedbackTags) : feedbackTags;
          parsedTags = JSON.stringify(Array.isArray(tags) ? tags.slice(0, 8) : []);
        } catch {
          parsedTags = null;
        }
      }
    } else {
      parsedRating = null;
      parsedReaction = null;
      parsedTags = null;
    }

    const sentiment = type === 'FEEDBACK' && parsedRating
      ? sentimentFromFeedback(parsedRating)
      : analyzeSentiment(description);

    const aiResult = classifyText(description);

    const finalDepartment = citizenDepartment && citizenDepartment !== 'UNASSIGNED'
      ? citizenDepartment
      : (aiResult.department !== 'UNASSIGNED' ? aiResult.department : 'UNASSIGNED');

    const citizenOverrode = citizenDepartment && citizenDepartment !== 'UNASSIGNED'
      && citizenDepartment !== aiResult.department;

    const trackingId = await generateTrackingId(prisma, finalDepartment);

    const submission = await prisma.submission.create({
      data: {
        trackingId,
        type,
        citizenDepartment: citizenDepartment || 'UNASSIGNED',
        description,
        contactNumber: contactNumber || null,
        email: email || null,
        address: address || null,
        sentiment,
        rating: parsedRating,
        reaction: parsedReaction,
        feedbackTags: parsedTags,
        department: finalDepartment,
        media: req.files?.length
          ? {
              create: req.files.map(f => ({
                filePath: cloudinaryConfigured ? f.path : `/uploads/${f.filename}`,
                fileType: f.mimetype,
              })),
            }
          : undefined,
        aiClassification: {
          create: {
            predictedDepartment: aiResult.department,
            confidence: aiResult.confidence,
            matchedKeywords: JSON.stringify(aiResult.matchedKeywords),
            citizenSelected: citizenOverrode ? citizenDepartment : null,
          },
        },
      },
      include: { media: true, aiClassification: true },
    });

    res.status(201).json({ trackingId: submission.trackingId, submission });

    if (submission.email) sendSubmissionReceivedEmail(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create submission' });
  }
}

async function getSubmissions(req, res) {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          location: true,
          media: true,
          aiClassification: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    res.json({ submissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

async function getSubmission(req, res) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        media: true,
        aiClassification: true,
      },
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
}

async function updateSubmission(req, res) {
  try {
    const { priority, department, status, changeReason } = req.body;
    const existing = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });

    if (department && department !== existing.department) {
      await prisma.departmentChangeLog.create({
        data: {
          submissionId: existing.id,
          trackingId: existing.trackingId,
          changedById: req.user.id,
          changedByName: req.user.fullName || req.user.email || req.user.id,
          changedByRole: req.user.role,
          fromDepartment: existing.department,
          toDepartment: department,
          reason: changeReason || null,
        },
      });

      await prisma.aIClassification.updateMany({
        where: { submissionId: existing.id },
        data: { adminCorrected: true },
      });
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        ...(priority && { priority }),
        ...(department && { department }),
        ...(status && { status }),
      },
      include: { location: true, media: true, aiClassification: true },
    });

    res.json(updated);

    if (status && status !== existing.status && updated.email) {
      sendStatusUpdateEmail(updated, status);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update submission' });
  }
}

async function trackSubmission(req, res) {
  try {
    const submission = await prisma.submission.findUnique({
      where: { trackingId: req.params.trackingId },
      include: {
        location: true,
        media: true,
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          select: { status: true, note: true, createdAt: true },
        },
      },
    });
    if (!submission) return res.status(404).json({ error: 'Tracking code not found' });
    const { userId, ...safe } = submission;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to track submission' });
  }
}

async function getSubmissionsByUser(req, res) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { userId: req.params.userId },
      include: { location: true, media: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}

module.exports = { createSubmission, getSubmissions, getSubmission, updateSubmission, trackSubmission, getSubmissionsByUser };
