/* globals Logger */

import { keys } from 'edx-ui-toolkit/js/utils/constants';

// @TODO: Figure out how to make webpack handle default exports when libraryTarget: 'window'
export class CourseOutline {  // eslint-disable-line import/prefer-default-export
  constructor() {
    const focusable = [...document.querySelectorAll('.outline-item.focusable')];

    focusable.forEach(el => el.addEventListener('keydown', (event) => {
      const index = focusable.indexOf(event.target);

      switch (event.key) {  // eslint-disable-line default-case
        case keys.down:
          event.preventDefault();
          focusable[Math.min(index + 1, focusable.length - 1)].focus();
          break;
        case keys.up:  // @TODO: Get these from the UI Toolkit
          event.preventDefault();
          focusable[Math.max(index - 1, 0)].focus();
          break;
      }
    }));

    [...document.querySelectorAll('a:not([href^="#"])')]
      .forEach(link => link.addEventListener('click', (event) => {
        Logger.log(
          'edx.ui.lms.link_clicked',
          {
            current_url: window.location.href,
            target_url: event.currentTarget.href,
          },
        );
      }),
    );

    [...document.querySelectorAll('li.outline-item.section')]
      .forEach(el => el.addEventListener('click', (event)=> {
        event.stopPropagation();
        //This is a proof of concept
        //We should not use jquery to make the toggle behavior
        //And this is not yet accessible
        $(event.target).closest('li.outline-item.section').children('ol').toggle("slow");
      }));

    [...document.querySelectorAll('li.subsection')]
      .forEach(el => el.addEventListener('click', (event)=> {
        event.stopPropagation();
        //This is a proof of concept
        //We should not use jquery to make the toggle behavior
        //And this is not yet accessible
        $(event.target).closest('li.subsection').children('ol').toggle("slow");
      }));

  }
}
