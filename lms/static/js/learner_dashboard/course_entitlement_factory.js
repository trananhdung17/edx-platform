import CourseEntitlementView from './views/course_entitlement_view';

function EntitlementFactory(options) {
  return new CourseEntitlementView(options);
}

export { EntitlementFactory };
