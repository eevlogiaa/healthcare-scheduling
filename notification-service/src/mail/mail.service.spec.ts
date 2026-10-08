import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

// transporter palsu, biar test gak pernah konek ke SMTP beneran
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}), close: jest.fn() })),
}));

const SMTP = {
  SMTP_HOST: 'mailpit',
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  MAIL_FROM: 'Clinic <no-reply@clinic.test>',
};

describe('MailService', () => {
  const createTransportMock = jest.mocked(createTransport);

  async function createService(overrides: Partial<Record<keyof typeof SMTP, unknown>> = {}) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: new ConfigService({ ...SMTP, ...overrides }) },
      ],
    }).compile();
    return moduleRef.get(MailService);
  }

  function lastTransporter() {
    return createTransportMock.mock.results[createTransportMock.mock.results.length - 1].value;
  }

  beforeEach(() => createTransportMock.mockClear());

  it('connects without authentication when no SMTP user is configured', async () => {
    await createService();
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 1025,
      secure: false,
    });
  });

  it('authenticates when SMTP credentials are configured', async () => {
    await createService({
      SMTP_USER: 'user',
      SMTP_PASSWORD: 'pass',
      SMTP_SECURE: true,
      SMTP_PORT: 465,
    });
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 465,
      secure: true,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('sends from the configured sender', async () => {
    const service = await createService();
    const message = { to: 'jane@example.com', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>' };

    await service.send(message);

    expect(lastTransporter().sendMail).toHaveBeenCalledWith({
      from: 'Clinic <no-reply@clinic.test>',
      ...message,
    });
  });

  it('closes the SMTP transport on shutdown', async () => {
    const service = await createService();

    service.onModuleDestroy();

    expect(lastTransporter().close).toHaveBeenCalled();
  });
});
