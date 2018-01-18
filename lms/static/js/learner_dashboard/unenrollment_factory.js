import UnenrollView from './views/unenroll_view';

function UnenrollmentFactory(options) {
  return new UnenrollView(options);
}

export { UnenrollmentFactory };
