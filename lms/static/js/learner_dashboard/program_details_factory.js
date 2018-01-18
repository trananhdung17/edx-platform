import ProgramDetailsView from './views/program_details_view';

function ProgramDetailsFactory(options) {
  return new ProgramDetailsView(options);
}

export { ProgramDetailsFactory };
