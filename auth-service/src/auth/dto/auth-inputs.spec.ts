import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginInput } from './login.input';
import { RegisterInput } from './register.input';

function check<T extends object>(type: new () => T, plain: object) {
  const instance = plainToInstance(type, plain);
  return { instance, errors: validateSync(instance) };
}

describe('auth inputs', () => {
  it('normalises the email to trimmed lower case', () => {
    const { instance, errors } = check(RegisterInput, {
      email: '  Jane@Example.COM ',
      password: 'secret-pass',
    });
    expect(errors).toHaveLength(0);
    expect(instance.email).toBe('jane@example.com');
  });

  it('rejects an invalid email and a short password on register', () => {
    const { errors } = check(RegisterInput, { email: 'not-an-email', password: 'short' });
    expect(errors.map((error) => error.property).sort()).toEqual(['email', 'password']);
  });

  it('rejects a password longer than bcrypt can hash', () => {
    const { errors } = check(RegisterInput, { email: 'a@b.co', password: 'x'.repeat(73) });
    expect(errors.map((error) => error.property)).toEqual(['password']);
  });

  it('requires a password on login', () => {
    const { errors } = check(LoginInput, { email: 'a@b.co', password: '' });
    expect(errors.map((error) => error.property)).toEqual(['password']);
  });
});
