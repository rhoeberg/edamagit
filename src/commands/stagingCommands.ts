import { window, commands, Uri, Selection } from 'vscode';
import { HunkView } from '../views/changes/hunkView';
import { ChangeView } from '../views/changes/changeView';
import MagitUtils from '../utils/magitUtils';
import FilePathUtils from '../utils/filePathUtils';
import { ChangeSectionView } from '../views/changes/changesSectionView';
import { Section } from '../views/general/sectionHeader';
import { MagitRepository } from '../models/magitRepository';
import { DocumentView } from '../views/general/documentView';
import { gitRun } from '../utils/gitRawRunner';
import { PickMenuItem, PickMenuUtil } from '../menu/pickMenu';
import * as ApplyAtPoint from './applyAtPointCommands';
import GitTextUtils from '../utils/gitTextUtils';
import * as Constants from '../common/constants';
import { View } from '../views/general/view';
import ViewUtils from '../utils/viewUtils';

export async function magitStage(repository: MagitRepository, currentView: DocumentView): Promise<any> {

  const selection = window.activeTextEditor!.selection;

  return ViewUtils.applyActionForSelection(repository, currentView, selection, [ChangeSectionView, ChangeView], stage);
}

async function stage(repository: MagitRepository, selection: Selection, selectedView?: View): Promise<any> {

  if (selectedView instanceof HunkView) {
    const changeHunk = (selectedView as HunkView).changeHunk;

    if (changeHunk.section !== Section.Staged) {

      const patch = GitTextUtils.generatePatchFromChangeHunkView(selectedView, selection);
      return ApplyAtPoint.apply(repository, patch, { index: true });

    } else {
      window.setStatusBarMessage('Already staged', Constants.StatusMessageDisplayTimeout);
    }

  } else if (selectedView instanceof ChangeView) {

    const magitChange = (selectedView as ChangeView).change;

    return stageFile(repository, magitChange.uri, magitChange.section === Section.Unstaged);

  } else if (selectedView instanceof ChangeSectionView) {
    const section = (selectedView as ChangeSectionView).section;

    switch (section) {
      case Section.Untracked:
        return stageAll(StageAllKind.AllUntracked);
      case Section.Unstaged:
        return stageAll(StageAllKind.AllTracked);
      default:
        break;
    }
  } else {

    if (repository.workingTreeChanges.length || repository.untrackedFiles.length) {

      const files: PickMenuItem<Uri>[] = [
        ...repository.workingTreeChanges,
        ...repository.untrackedFiles,
        // ...currentrepository.mergeChanges
      ].map(c => ({ label: FilePathUtils.uriPathRelativeTo(c.uri, repository.uri), meta: c.uri }));

      const chosenFile = await PickMenuUtil.showMenu(files, 'Stage file');

      if (chosenFile) {
        return stageFile(repository, chosenFile);
      }

    }
  }
}

export async function magitStageAll(repository: MagitRepository, currentView: DocumentView): Promise<void> {
  return stageAll();
}

export enum StageAllKind {
  All = 'stageAll',
  AllTracked = 'stageAllTracked',
  AllUntracked = 'stageAllUntracked'
}

async function stageAll(kind: StageAllKind = StageAllKind.AllTracked): Promise<void> {
  return commands.executeCommand('git.' + kind.valueOf());
}

export async function magitUnstage(repository: MagitRepository, currentView: DocumentView): Promise<any> {

  const selection = window.activeTextEditor!.selection;
  return ViewUtils.applyActionForSelection(repository, currentView, selection, [ChangeSectionView, ChangeView], unstage);
}

async function unstage(repository: MagitRepository, selection: Selection, selectedView?: View): Promise<any> {

  if (selectedView instanceof HunkView) {
    const changeHunk = (selectedView as HunkView).changeHunk;

    if (changeHunk.section === Section.Staged) {
      const patch = GitTextUtils.generatePatchFromChangeHunkView(selectedView, selection, true);
      return ApplyAtPoint.apply(repository, patch, { index: true, reverse: true });
    } else {
      window.setStatusBarMessage('Already unstaged', Constants.StatusMessageDisplayTimeout);
    }
  } else if (selectedView instanceof ChangeView) {

    return unstageFile(repository, selectedView.change.uri);

  } else if (selectedView instanceof ChangeSectionView) {
    if (selectedView.section === Section.Staged) {
      return unstageAll();
    } else {
      window.setStatusBarMessage('Already unstaged', Constants.StatusMessageDisplayTimeout);
    }
  } else {

    const files: PickMenuItem<Uri>[] = repository.indexChanges!
      .map(c => ({ label: FilePathUtils.uriPathRelativeTo(c.uri, repository.uri), meta: c.uri }));

    const chosenFile = await PickMenuUtil.showMenu<Uri>(files, 'Unstage file');

    if (chosenFile) {
      return unstageFile(repository, chosenFile);
    }
  }
}

export async function magitUnstageAll(repository: MagitRepository, currentView: DocumentView): Promise<void> {

  if (await MagitUtils.confirmAction('Unstage all changes?')) {
    return unstageAll();
  }
}

async function unstageAll(): Promise<void> {
  return commands.executeCommand('git.unstageAll');
}

export async function stageFile(repository: MagitRepository, fileUri: Uri, update = false) {
  let args = ['add'];

  if (update) {
    args.push('-u');
  } else {
    args.push('-A');
  }

  args.push('--', fileUri.fsPath);

  return gitRun(repository.gitRepository, args);
}

export async function unstageFile(repository: MagitRepository, fileUri: Uri) {
  const args = ['reset', '--', fileUri.fsPath];
  return gitRun(repository.gitRepository, args);
}