import { QuizAdminController } from './quiz-admin.controller';
import { AdminUpdateQuizDto } from '../../dto/request/admin-update-quiz.dto';

const makePresenter = () => ({
  updateQuiz: (row: object) => row,
});

describe('QuizAdminController', () => {
  it('forwards isFeatured/isHidden to the application service', async () => {
    const quizRow = {
      quizId: 'q1',
      creatorId: 'u1',
      title: 'Quiz',
      isFeatured: true,
      isHidden: false,
    };
    const service = {
      adminUpdatePrivilegedFields: jest.fn(async () => quizRow),
    };
    const controller = new QuizAdminController(service as never, makePresenter() as never);

    const body = new AdminUpdateQuizDto();
    body.isFeatured = true;
    body.isHidden = false;

    const result = await controller.adminUpdate({ sub: 'admin-1' } as never, 'q1', body);

    expect(service.adminUpdatePrivilegedFields).toHaveBeenCalledWith({
      actor: { sub: 'admin-1' },
      quizIdOrSlug: 'q1',
      isFeatured: true,
      isHidden: false,
    });
    expect(result).toEqual(quizRow);
  });

  it('passes through undefined when isFeatured/isHidden are not provided', async () => {
    const service = {
      adminUpdatePrivilegedFields: jest.fn(async () => ({})),
    };
    const controller = new QuizAdminController(service as never, makePresenter() as never);

    const body = new AdminUpdateQuizDto();

    await controller.adminUpdate({ sub: 'admin-1' } as never, 'q2', body);

    expect(service.adminUpdatePrivilegedFields).toHaveBeenCalledWith({
      actor: { sub: 'admin-1' },
      quizIdOrSlug: 'q2',
      isFeatured: undefined,
      isHidden: undefined,
    });
  });
});
