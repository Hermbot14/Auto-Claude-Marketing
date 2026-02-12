/**
 * Content Routes
 *
 * REST API endpoints for content item management.
 */

import { Router } from 'express';
import { ContentController } from '../controllers/contentController.js';
import { validateRequest } from '../middleware/validation.js';
import { contentSchemas } from '../validators/content.js';

const router = Router();
const controller = new ContentController();

// Content CRUD operations
router.post(
  '/',
  validateRequest(contentSchemas.create),
  controller.createContent.bind(controller)
);

router.get(
  '/',
  validateRequest(contentSchemas.list, 'query'),
  controller.listContent.bind(controller)
);

router.get(
  '/:id',
  controller.getContent.bind(controller)
);

router.put(
  '/:id',
  validateRequest(contentSchemas.update),
  controller.updateContent.bind(controller)
);

router.delete(
  '/:id',
  controller.deleteContent.bind(controller)
);

// Content versions
router.get(
  '/:id/versions',
  controller.getContentVersions.bind(controller)
);

router.post(
  '/:id/versions/:versionId/restore',
  controller.restoreVersion.bind(controller)
);

// Content publishing
router.post(
  '/:id/publish',
  controller.publishContent.bind(controller)
);

router.post(
  '/:id/unpublish',
  controller.unpublishContent.bind(controller)
);

// Content approval workflow
router.post(
  '/:id/submit',
  controller.submitForApproval.bind(controller)
);

router.post(
  '/:id/approve',
  controller.approveContent.bind(controller)
);

router.post(
  '/:id/reject',
  controller.rejectContent.bind(controller)
);

// Content search
router.get(
  '/search',
  validateRequest(contentSchemas.search, 'query'),
  controller.searchContent.bind(controller)
);

export default router;
